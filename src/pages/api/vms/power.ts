import type { APIRoute } from "astro";
import { auth } from "../../../lib/auth";
import { getPools, getPool, startVM, stopVM, shutdownVM, rebootVM } from "../../../api/client";

const ALLOWED_ACTIONS = ["start", "stop", "shutdown", "reboot"] as const;
type PowerAction = (typeof ALLOWED_ACTIONS)[number];

export const POST: APIRoute = async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
        return json({ error: "Unauthorized" }, 401);
    }

    let body: { vmid?: unknown; node?: unknown; action?: unknown };
    try {
        body = await request.json();
    } catch {
        return json({ error: "Invalid JSON body" }, 400);
    }

    const vmid  = Number(body.vmid);
    const node  = String(body.node ?? "");
    const action = body.action as PowerAction;

    if (!vmid || !node || !ALLOWED_ACTIONS.includes(action)) {
        return json({ error: "Missing or invalid fields: vmid, node, action" }, 400);
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
            return json({ error: "No pool found for user" }, 403);
        }

        const poolDetail = await getPool(userPool.poolid);
        const owns = poolDetail.members.some(m => m.vmid === vmid && m.node === node);
        if (!owns) {
            return json({ error: "VM not in user pool" }, 403);
        }
    } catch (e) {
        return json({ error: `Pool lookup failed: ${e instanceof Error ? e.message : e}` }, 500);
    }

    // Execute the action
    try {
        switch (action) {
            case "start":    await startVM(node, vmid);    break;
            case "stop":     await stopVM(node, vmid);     break;
            case "shutdown": await shutdownVM(node, vmid); break;
            case "reboot":   await rebootVM(node, vmid);   break;
        }
        return json({ ok: true, action, vmid });
    } catch (e) {
        return json({ error: `Action failed: ${e instanceof Error ? e.message : e}` }, 500);
    }
};

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}
