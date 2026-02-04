import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createGeminiProxyMiddleware } from './server/geminiProxy';

const geminiProxyPlugin = () => ({
  name: 'gemini-proxy',
  configureServer(server: { middlewares: { use: (middleware: ReturnType<typeof createGeminiProxyMiddleware>) => void } }) {
    server.middlewares.use(createGeminiProxyMiddleware());
  },
  configurePreviewServer(server: { middlewares: { use: (middleware: ReturnType<typeof createGeminiProxyMiddleware>) => void } }) {
    server.middlewares.use(createGeminiProxyMiddleware());
  },
});

export default defineConfig(() => {
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), geminiProxyPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
