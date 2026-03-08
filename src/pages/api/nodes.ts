import type { APIRoute } from "astro";
import { auth } from "../../lib/auth";
import { getNodes, getStorage } from "../../api/client";

export const GET: APIRoute = async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    try {
        const nodes = await getNodes();
        const result = await Promise.all(
            nodes
                .filter(n => n.status === "online")
                .map(async (n) => {
                    try {
                        const storage = await getStorage(n.node);
                        // Only include storage pools that can hold VM images
                        const vmStorage = storage.filter(s =>
                            s.content?.includes("images") && s.active
                        );
                        return { node: n.node, storage: vmStorage.map(s => s.storage) };
                    } catch {
                        return { node: n.node, storage: [] };
                    }
                })
        );
        return new Response(JSON.stringify({ nodes: result }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
    }
};
