// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { vncProxyPlugin } from './vnc-proxy-plugin.mjs';

// https://astro.build/config
export default defineConfig({
    output: 'server',
    vite: {
        plugins: [tailwindcss(), vncProxyPlugin()]
    }
});
