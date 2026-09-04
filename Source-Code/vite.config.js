// import { defineConfig } from "vite";
// import react from "@vitejs/plugin-react";

// export default defineConfig({
//   plugins: [react()],
//   server: {
//     port: 5173,
//     proxy: {
//       "/api": {
//         target: "http://127.0.0.1:5001",
//         changeOrigin: true,
//       },
//     },
//   },
// });


import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
 
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
 
  const API_TARGET = env.VITE_API_TARGET || 'http://127.0.0.1:5001'
  const COPILOT_TARGET = env.VITE_COPILOT_TARGET || API_TARGET
 
  const STRIP_API_PREFIX = env.VITE_STRIP_API_PREFIX === 'true'
  const rewriteFn = (path) =>
    STRIP_API_PREFIX ? path.replace(/^\/api/, '') : path
 
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api/copilot': {
          target: COPILOT_TARGET,
          changeOrigin: true,
          secure: false,
          rewrite: rewriteFn,
        },
        '/api': {
          target: API_TARGET,
          changeOrigin: true,
          secure: false,
          rewrite: rewriteFn,
        },
      },
    },
  }
})