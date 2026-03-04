import { betterAuth } from "better-auth";
import { genericOAuth } from "better-auth/plugins";
import Database from "better-sqlite3";

export const auth = betterAuth({
    baseURL: import.meta.env.BETTER_AUTH_URL ?? "http://localhost:4321",
    secret: import.meta.env.BETTER_AUTH_SECRET,
    database: new Database("data/db.sqlite"),
    plugins: [
        genericOAuth({
            config: [
                {
                    providerId: "authentik",
                    clientId: import.meta.env.OIDC_CLIENT_ID,
                    clientSecret: import.meta.env.OIDC_CLIENT_SECRET,
                    discoveryUrl: `${import.meta.env.OIDC_ISSUER}.well-known/openid-configuration`,
                    scopes: ["openid", "email", "profile"],
                    mapProfileToUser: (profile: any) => ({
                        name: profile.name || profile.preferred_username || profile.nickname || profile.email,
                        email: profile.email,
                        emailVerified: profile.email_verified ?? false,
                        image: profile.picture ?? null,
                    }),
                },
            ],
        }),
    ],
});