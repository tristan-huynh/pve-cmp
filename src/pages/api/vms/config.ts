import type { APIRoute } from "astro";
import { auth } from "../../../lib/auth";
import { getPools, getPool, getVMConfig, updateVMConfig } from "../../../api/client";

async function resolvePoolMember(session: { user: { email?: string | null; name?: string | null } }, vmid: number) {
    const user = session.user;
    const pools = await getPools();
    const userPool = pools.find(p =>
        p.poolid === user.email ||
        p.poolid === user.email?.split("@")[0] ||
        p.poolid === user.name
    );
    if (!userPool) return null;
    const poolDetail = await getPool(userPool.poolid);
    return poolDetail.members.find(m => m.vmid === vmid && m.type === "qemu") ?? null;
}

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

    try {
        const member = await resolvePoolMember(session, vmid);
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

export const PATCH: APIRoute = async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    let body: { vmid?: number; node?: string; cores?: number; memory?: number; description?: string };
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
    }

    const { vmid, node, cores, memory, description } = body;

    if (!vmid || !node) {
        return new Response(JSON.stringify({ error: "Missing vmid or node" }), { status: 400 });
    }

    try {
        const member = await resolvePoolMember(session, vmid);
        if (!member) {
            return new Response(JSON.stringify({ error: "VM not in your pool" }), { status: 403 });
        }

        const patch: Record<string, unknown> = {};
        if (cores   !== undefined) patch.cores   = cores;
        if (memory  !== undefined) patch.memory  = memory;
        if (description !== undefined) patch.description = description;

        await updateVMConfig(node, vmid, patch);
        return new Response(JSON.stringify({ ok: true }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
    }
};

