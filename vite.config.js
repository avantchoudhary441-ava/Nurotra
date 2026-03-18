

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import Icons from 'unplugin-icons/vite';

export default defineConfig({
  plugins: [
    react(),
    Icons({
      compiler: 'react',
    }),
    nodePolyfills({
      // Whether to polyfill `global` variable
      global: true,
      // Whether to polyfill `process` variable
      process: true,
      // Whether to polyfill `Buffer` variable
      buffer: true,
    }),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
    },
  },
});


