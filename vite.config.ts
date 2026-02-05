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
      port: Number(env.VITE_PORT) || 8080,
      proxy: {
        // Proxy /api endpoints to the backend
        '/api': {
          target: env.VITE_BACKEND_URL || 'http://localhost:3001',
          changeOrigin: true,
        },
        // Proxy /external-auth to backend /api/external-auth for SSO
        '/external-auth': {
          target: env.VITE_BACKEND_URL || 'http://localhost:3001',
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
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Vendor chunks
            if (id.includes('node_modules')) {
              // React and React DOM
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
                return 'react-vendor';
              }
              // Radix UI components
              if (id.includes('@radix-ui')) {
                return 'ui-vendor';
              }
              // React Query
              if (id.includes('@tanstack/react-query')) {
                return 'query-vendor';
              }
              // Form libraries
              if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) {
                return 'form-vendor';
              }
              // Charts
              if (id.includes('recharts')) {
                return 'chart-vendor';
              }
              // Other large vendor libraries
              if (id.includes('lucide-react')) {
                return 'icons-vendor';
              }
              // Default vendor chunk for other node_modules
              return 'vendor';
            }
            // Feature-based chunks
            if (id.includes('/pages/admin/')) {
              return 'admin';
            }
            if (id.includes('/pages/calibration/')) {
              return 'calibration';
            }
            if (id.includes('/pages/') && (
              id.includes('Evaluation') || 
              id.includes('MyRating') || 
              id.includes('ManagerEvaluation')
            )) {
              return 'evaluation';
            }
          },
        },
      },
      chunkSizeWarningLimit: 1000, // Increase warning limit to 1MB
    },
  };
});
