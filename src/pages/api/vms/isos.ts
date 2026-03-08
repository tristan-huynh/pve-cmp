import type { APIRoute } from "astro";
import { getStorageContent } from "../../../api/client";
import { auth } from "../../../lib/auth";

export const GET: APIRoute = async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    const url     = new URL(request.url);
    const node    = url.searchParams.get("node") ?? "";
    const storage = url.searchParams.get("storage") ?? "";

    if (!node || !storage) {
        return new Response(JSON.stringify({ error: "Missing node or storage" }), { status: 400 });
    }

    try {
        const contents = await getStorageContent(node, storage, "iso");
        const isos = contents
            .filter(c => c.content === "iso")
            .map(c => ({ volid: c.volid, name: c.name ?? c.volid.split("/").pop() ?? c.volid }));

        return new Response(JSON.stringify({ isos }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (e) {
        return new Response(JSON.stringify({ isos: [] }), {
            headers: { "Content-Type": "application/json" },
        });
    }
};
