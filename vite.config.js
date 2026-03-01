import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(function (_a) {
    var _b;
    var mode = _a.mode;
    var env = loadEnv(mode, process.cwd(), '');
    var allowedHosts = ((_b = env.VITE_ALLOWED_HOSTS) !== null && _b !== void 0 ? _b : '')
        .split(',')
        .map(function (host) { return host.trim(); })
        .filter(Boolean);
    return {
        plugins: [react()],
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
        },
    };
});
