import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  build: {
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        // A single huge entry chunk exceeded the bundler's parser; split third-party code.
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          const m = id.split("node_modules/").pop()!.split("/");
          const name = m[0].startsWith("@") ? `${m[0]}/${m[1]}` : m[0];
          if (/^(react|react-dom|scheduler|react-router|react-router-dom)$/.test(name)) return "vendor-react";
          return "vendor-" + name.replace("@", "").replace("/", "-");
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
