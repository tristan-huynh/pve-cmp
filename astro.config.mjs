// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import auth from 'auth-astro';

// https://astro.build/config
export default defineConfig({
    output: 'server',
    integrations: [auth()],
    vite: {
        plugins: [tailwindcss()]
    }
});
