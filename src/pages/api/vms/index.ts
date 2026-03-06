import type { APIRoute } from "astro";
import { auth } from "../../../lib/auth";
import { getPools, getPool, getVMStatus } from "../../../api/client";

export const GET: APIRoute = async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const user = session.user;
    try {
        const pools = await getPools();
        const userPool = pools.find(p =>
            p.poolid === user.email ||
            p.poolid === user.email?.split("@")[0] ||
            p.poolid === user.name
        );

        if (!userPool) {
            return new Response(JSON.stringify({ vms: [], pool: null }), {
                headers: { "Content-Type": "application/json" },
            });
        }

        const poolDetail = await getPool(userPool.poolid);
        const vmMembers = poolDetail.members.filter(m => m.type === "qemu");

        const vms = (await Promise.all(
            vmMembers.map(async (m) => {
                try {
                    const status = await getVMStatus(m.node, m.vmid);
                    return { ...status, node: m.node };
                } catch {
                    return null;
                }
            })
        )).filter(Boolean);

        return new Response(JSON.stringify({ vms, pool: userPool.poolid }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
    }
};
