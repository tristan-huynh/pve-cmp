import { auth } from "../../../lib/auth";
import type { APIRoute } from "astro";

const handler: APIRoute = async (ctx) => {
    return auth.handler(ctx.request);
};

export const ALL = handler;
export const GET = handler;
export const POST = handler;