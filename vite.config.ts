import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    server: {
      host: "::",
      port: Number(env.VITE_PORT) ,
      proxy: {
        // Proxy /api endpoints to the backend
        '/api': {
          target: env.VITE_BACKEND_URL ,
          changeOrigin: true,
        },
        // Proxy /external-auth to backend /api/external-auth for SSO
        '/external-auth': {
          target: env.VITE_BACKEND_URL ,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/external-auth/, '/api/external-auth'),
        },
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
