/**
 * Vite plugin that proxies VNC WebSocket connections through the dev server.
 *
 * Flow:
 *  1. Browser calls GET /api/vnc/ticket → server calls PVE /vncproxy → returns { ticket, sessionToken }
 *  2. Browser stores the ticket (used later as the VNC RFB password).
 *  3. Browser opens a WebSocket to /api/vnc/ws?session=<sessionToken>
 *  4. This plugin intercepts that upgrade, looks up the session, connects to PVE's
 *     vncwebsocket from *server-side* (same IP that called vncproxy), and pipes
 *     all frames bidirectionally.
 */

import { WebSocketServer } from "ws";
import WebSocket from "ws";
import https from "https";
import { loadEnv } from "vite";

// ---------------------------------------------------------------------------
// Shared in-memory session store (survives SSR hot-reloads via globalThis)
// ---------------------------------------------------------------------------
if (!globalThis.__vncSessions) {
    globalThis.__vncSessions = new Map();
}
/** @type {Map<string, { ticket: string; port: number; node: string; vmid: number; expiresAt: number }>} */
const sessions = globalThis.__vncSessions;

// Clean up expired sessions every 60 s
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of sessions) {
        if (v.expiresAt < now) sessions.delete(k);
    }
}, 60_000);

/**
 * Store a VNC session and return a one-time session token.
 * @param {{ ticket: string; port: number; node: string; vmid: number }} data
 * @returns {string} sessionToken (UUID)
 */
export function storeVncSession(data) {
    const token = crypto.randomUUID();
    sessions.set(token, { ...data, expiresAt: Date.now() + 30_000 }); // 30 s to connect
    return token;
}

// Expose via globalThis so API routes can call it without a direct import
globalThis.__vncStoreSession = storeVncSession;

// ---------------------------------------------------------------------------
// Vite plugin
// ---------------------------------------------------------------------------
export function vncProxyPlugin() {
    let pveHost = "";
    let tokenId = "";
    let tokenSecret = "";

    return {
        name: "vnc-proxy",
        configResolved(config) {
            // Load ALL .env variables (empty prefix = no filter, overrides process.env)
            const env = loadEnv(config.mode, process.cwd(), "");
            pveHost     = (env.PVE_HOST     ?? process.env.PVE_HOST     ?? "").replace(/^https?:\/\//, "");
            tokenId     = env.PVE_TOKEN_ID  ?? process.env.PVE_TOKEN_ID  ?? "";
            tokenSecret = env.PVE_TOKEN_SECRET ?? process.env.PVE_TOKEN_SECRET ?? "";
            console.log(`[vnc-proxy] pveHost=${pveHost || "(empty)"} tokenId=${tokenId || "(empty)"}`);
        },
        configureServer(server) {
            const wss = new WebSocketServer({ noServer: true });

            server.httpServer?.on("upgrade", (req, socket, head) => {
                const url = new URL(req.url, "http://localhost");
                if (!url.pathname.startsWith("/api/vnc/ws")) return;

                wss.handleUpgrade(req, socket, head, async (browserWs) => {
                    const token = url.searchParams.get("session");
                    const session = token ? sessions.get(token) : null;

                    if (!session) {
                        browserWs.close(4000, "Invalid or expired session token");
                        return;
                    }
                    // One-time use
                    sessions.delete(token);

                    const { ticket, port, node, vmid } = session;
                    if (!pveHost) {
                        browserWs.close(4001, "PVE_HOST not configured");
                        return;
                    }

                    const pveWsUrl =
                        `wss://${pveHost}/api2/json/nodes/${node}/qemu/${vmid}/vncwebsocket` +
                        `?port=${port}&vncticket=${encodeURIComponent(ticket)}`;

                    const pveWs = new WebSocket(pveWsUrl, "binary", {
                        headers: {
                            Authorization: `PVEAPIToken=${tokenId}=${tokenSecret}`,
                        },
                        rejectUnauthorized: false, // Allow self-signed certs
                    });

                    pveWs.once("open", () => {
                        browserWs.on("message", (data, isBinary) =>
                            pveWs.readyState === WebSocket.OPEN && pveWs.send(data, { binary: isBinary })
                        );
                        pveWs.on("message", (data, isBinary) =>
                            browserWs.readyState === WebSocket.OPEN && browserWs.send(data, { binary: isBinary })
                        );
                    });

                    pveWs.once("error", (err) => {
                        console.error("[vnc-proxy] PVE WS error:", err.message);
                        browserWs.close(4002, "PVE connection failed");
                    });

                    browserWs.on("close", () => pveWs.readyState === WebSocket.OPEN && pveWs.close());
                    pveWs.on("close",    () => browserWs.readyState === WebSocket.OPEN && browserWs.close());
                    browserWs.on("error", () => pveWs.readyState === WebSocket.OPEN && pveWs.close());
                    pveWs.on("error",    () => browserWs.readyState === WebSocket.OPEN && browserWs.close());
                });
            });
        },
    };
}
