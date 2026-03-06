import type { APIRoute } from "astro";
import { auth } from "../../../lib/auth";
import { getPools, getPool, getVMConfig } from "../../../api/client";

export const GET: APIRoute = async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const url = new URL(request.url);
    const vmid = Number(url.searchParams.get("vmid"));
    const node = url.searchParams.get("node");

    if (!vmid || !node) {
        return new Response(JSON.stringify({ error: "Missing vmid or node" }), { status: 400 });
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

        const config = await getVMConfig(node, vmid);
        return new Response(JSON.stringify({ config }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
    }
};
