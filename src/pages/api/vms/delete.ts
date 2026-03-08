import type { APIRoute } from "astro";
import { auth } from "../../../lib/auth";
import { getPools, getPool, deleteVM } from "../../../api/client";

export const DELETE: APIRoute = async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    let body: { vmid?: unknown; node?: unknown };
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
    }

    const vmid = Number(body.vmid);
    const node = typeof body.node === "string" ? body.node : null;

    if (!vmid || !node) {
        return new Response(JSON.stringify({ error: "Missing vmid or node" }), { status: 400 });
    }

    // Verify the VM belongs to this user's pool
    const user = session.user;
    let pools;
    try {
        pools = await getPools();
    } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
    }

    const userPool = pools.find(p =>
        p.poolid === user.email ||
        p.poolid === user.email?.split("@")[0] ||
        p.poolid === user.name
    );
    if (!userPool) {
        return new Response(JSON.stringify({ error: "No pool found for user" }), { status: 403 });
    }

    const poolDetail = await getPool(userPool.poolid);
    const member = poolDetail.members.find(m => m.vmid === vmid && m.type === "qemu");
    if (!member) {
        return new Response(JSON.stringify({ error: "VM not in your pool" }), { status: 403 });
    }

    try {
        const taskId = await deleteVM(node, vmid);
        return new Response(JSON.stringify({ ok: true, task: taskId }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
    }
};
