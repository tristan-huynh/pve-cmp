import { defineMiddleware } from "astro:middleware";
import { auth } from "./lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth"];

export const onRequest = defineMiddleware(async (context, next) => {
    const { pathname } = context.url;

    if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
        return next();
    }

    const session = await auth.api.getSession({
        headers: context.request.headers,
    });

    if (!session) {
        return context.redirect("/login");
    }

    return next();
});
