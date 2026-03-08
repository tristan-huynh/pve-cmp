import type { APIRoute } from "astro";
import { auth } from "../../../lib/auth";
import { getPools, getPool, startVM, stopVM, shutdownVM, rebootVM } from "../../../api/client";

const ALLOWED_ACTIONS = ["start", "stop", "shutdown", "reboot"] as const;
type PowerAction = typeof ALLOWED_ACTIONS[number];

export const POST: APIRoute = async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    let body: { vmid?: number; node?: string; action?: string };
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
    }

    const { vmid, node, action } = body;

    if (!vmid || !node || !action) {
        return new Response(JSON.stringify({ error: "Missing vmid, node, or action" }), { status: 400 });
    }

    if (!ALLOWED_ACTIONS.includes(action as PowerAction)) {
        return new Response(JSON.stringify({ error: `Invalid action "${action}"` }), { status: 400 });
    }

    // Verify the VM belongs to the user's pool
    const user = session.user;
    try {
        const pools = await getPools();
        const userPool = pools.find(p =>
            p.poolid === user.email ||
            p.poolid === user.email?.split("@")[0] ||
            p.poolid === user.name
        );

        if (!userPool) {
            return new Response(JSON.stringify({ error: "No pool found" }), { status: 403 });
        }

        const poolDetail = await getPool(userPool.poolid);
        const member = poolDetail.members.find(m => m.vmid === vmid && m.type === "qemu");
        if (!member) {
            return new Response(JSON.stringify({ error: "VM not in your pool" }), { status: 403 });
        }

        switch (action as PowerAction) {
            case "start":    await startVM(node, vmid);    break;
            case "stop":     await stopVM(node, vmid);     break;
            case "shutdown": await shutdownVM(node, vmid); break;
            case "reboot":   await rebootVM(node, vmid);   break;
        }

        return new Response(JSON.stringify({ ok: true, action }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
    }
};
