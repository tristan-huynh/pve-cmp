import type { APIRoute } from "astro";
import { auth } from "../../../lib/auth";
import { getPools, getPool, getVNCProxy } from "../../../api/client";
// @ts-ignore – plugin lives outside src/, loaded at runtime via globalThis
declare const globalThis: Record<string, unknown>;

export const GET: APIRoute = async ({ request, url }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return json({ error: "Unauthorized" }, 401);

    const vmid = Number(url.searchParams.get("vmid"));
    const node = url.searchParams.get("node") ?? "";
    if (!vmid || !node) return json({ error: "Missing vmid or node" }, 400);

    // Verify the VM belongs to this user's pool
    try {
        const user = session.user;
        const pools = await getPools();
        const userPool = pools.find(
            (p) =>
                p.poolid === user.email ||
                p.poolid === user.email?.split("@")[0] ||
                p.poolid === user.name
        );
        if (!userPool) return json({ error: "No pool found for user" }, 403);

        const poolDetail = await getPool(userPool.poolid);
        const owns = poolDetail.members.some((m) => m.vmid === vmid && m.node === node);
        if (!owns) return json({ error: "VM not in user pool" }, 403);
    } catch (e) {
        return json({ error: `Pool check failed: ${e instanceof Error ? e.message : e}` }, 500);
    }

    // Get VNC proxy ticket from PVE
    let ticket: string, port: number;
    try {
        const proxy = await getVNCProxy(node, vmid);
        ticket = proxy.ticket;
        port   = proxy.port;
    } catch (e) {
        return json({ error: `VNC proxy failed: ${e instanceof Error ? e.message : e}` }, 500);
    }

    // Store session and return a one-time token
    // storeVncSession is injected by the Vite plugin via globalThis
    const store = globalThis.__vncStoreSession as ((d: object) => string) | undefined;
    if (!store) {
        // Fallback: return ticket directly (won't work without the proxy, but avoids 500)
        return json({ ticket, port, sessionToken: null });
    }

    const sessionToken = store({ ticket, port, node, vmid });
    return json({ ticket, sessionToken });
};

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}
