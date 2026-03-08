import type { APIRoute } from "astro";
import { getAgentNetworkInterfaces } from "../../../api/client";
import { auth } from "../../../lib/auth";

export const GET: APIRoute = async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    const url    = new URL(request.url);
    const vmid   = Number(url.searchParams.get("vmid"));
    const node   = url.searchParams.get("node") ?? "";

    if (!vmid || !node) {
        return new Response(JSON.stringify({ error: "Missing vmid or node" }), { status: 400 });
    }

    try {
        const data = await getAgentNetworkInterfaces(node, vmid);
        const ifaces = data?.result ?? [];

        const ipv4: string[] = [];
        const ipv6: string[] = [];

        for (const iface of ifaces) {
            if (iface.name === "lo") continue;
            for (const addr of iface["ip-addresses"] ?? []) {
                const ip = addr["ip-address"];
                // Filter out loopback ranges and internal 172.16–31.* addresses
                if (ip.startsWith("127.") || ip === "::1") continue;
                if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) continue;
                if (addr["ip-address-type"] === "ipv4") ipv4.push(ip);
                else ipv6.push(ip);
            }
        }

        return new Response(JSON.stringify({ ipv4, ipv6 }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (e) {
        // Agent not running or not installed — return empty rather than 500
        return new Response(JSON.stringify({ ipv4: [], ipv6: [] }), {
            headers: { "Content-Type": "application/json" },
        });
    }
};
