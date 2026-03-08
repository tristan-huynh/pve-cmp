import type { APIRoute } from "astro";
import { auth } from "../../../lib/auth";
import { getPools, getPool, getNextVmid, createVM, addVMToPool } from "../../../api/client";

export const POST: APIRoute = async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    let body: {
        node?: string;
        name?: string;
        cores?: number;
        memory?: number;
        diskSize?: number;
        storage?: string;
        iso?: string; // e.g. "local:iso/debian-12.iso"
    };
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
    }

    const { node, name, cores = 1, memory = 512, diskSize = 8, storage = "local-lvm", iso } = body;

    if (!node || !name) {
        return new Response(JSON.stringify({ error: "Missing node or name" }), { status: 400 });
    }

    const user = session.user;
    try {
        // Resolve user's pool
        const pools = await getPools();
        const userPool = pools.find(p =>
            p.poolid === user.email ||
            p.poolid === user.email?.split("@")[0] ||
            p.poolid === user.name
        );
        if (!userPool) {
            return new Response(JSON.stringify({ error: "No pool found for your account" }), { status: 403 });
        }

        // Check VM limit (10)
        const poolDetail = await getPool(userPool.poolid);
        const vmCount = poolDetail.members.filter(m => m.type === "qemu").length;
        if (vmCount >= 10) {
            return new Response(JSON.stringify({ error: "VM limit (10) reached" }), { status: 403 });
        }

        // Get next available VMID
        const vmid = await getNextVmid();

        // Create the VM
        await createVM(node, {
            vmid,
            name,
            cores,
            memory,
            sockets: 1,
            scsihw: "virtio-scsi-pci",
            [`scsi0`]: `${storage}:${diskSize}`,
            net0: "virtio,bridge=vmbr0",
            ostype: "l26",
            agent: "1",
            ...(iso ? { ide2: `${iso},media=cdrom`, boot: "order=ide2;scsi0" } : {}),
        });

        // Add to user's pool
        await addVMToPool(userPool.poolid, vmid);

        return new Response(JSON.stringify({ ok: true, vmid }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
    }
};
