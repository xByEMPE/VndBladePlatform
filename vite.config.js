import path from 'node:path';
import { createLogger, defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isDev = process.env.NODE_ENV !== 'production';

const logger = createLogger()
const loggerError = logger.error

logger.error = (msg, options) => {
    if (options?.error?.toString().includes('CssSyntaxError: [postcss]')) {
        return;
    }

    loggerError(msg, options);
}

export default defineConfig({
    customLogger: logger,
    esbuild: {
        drop: isDev ? [] : ['console', 'debugger'],
    },
    plugins: [
        react()
    ],
    server: {
        cors: true,
        headers: {
            'Cross-Origin-Embedder-Policy': 'credentialless',
        },
        allowedHosts: true,
        fs: {
            strict: false
        }
    },
    preview: {
        open: true,
        cors: true
    },
    resolve: {
        extensions: ['.jsx', '.js', '.tsx', '.ts', '.json', ],
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    }
});
