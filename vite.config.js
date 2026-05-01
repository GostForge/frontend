import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(function (_a) {
    var mode = _a.mode;
    // loadEnv reads .env files; process.env has Docker / shell env vars
    var fileEnv = loadEnv(mode, process.cwd(), 'VITE_');
    var rawHosts = process.env.VITE_ALLOWED_HOSTS || fileEnv.VITE_ALLOWED_HOSTS || '';
    var allowedHosts = rawHosts === 'all'
        ? true
        : rawHosts.split(',').map(function (h) { return h.trim(); }).filter(Boolean);
    return {
        plugins: [react()],
        build: {
            sourcemap: false,
        },
        server: {
            host: '0.0.0.0',
            port: 3001,
            allowedHosts: allowedHosts,
            proxy: {
                '/api': {
                    target: 'http://backend:8080',
                    changeOrigin: true,
                },
                '/actuator': {
                    target: 'http://backend:8080',
                    changeOrigin: true,
                },
            },
        },
        preview: {
            host: '0.0.0.0',
            port: 3001,
            allowedHosts: allowedHosts,
        },
    };
});
