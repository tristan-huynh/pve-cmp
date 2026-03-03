import { defineConfig } from "auth-astro";

export default defineConfig({
    providers: [
        {
            id: "authentik",
            name: "Authentik",
            type: "oidc",
            issuer: import.meta.env.OIDC_ISSUER,
            clientId: import.meta.env.OIDC_CLIENT_ID,
            clientSecret: import.meta.env.OIDC_CLIENT_SECRET,
        },
    ],
    callbacks: {
        async session({ session, token }) {
            // Forward the sub (user id) to the session so pages can use it
            if (token?.sub) session.user.id = token.sub;
            return session;
        },
    },
});
