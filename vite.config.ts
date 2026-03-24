import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "path";

export default defineConfig({
  root: "src/midas/ui",
  plugins: [tailwindcss(), TanStackRouterVite(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/midas/ui"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "src/midas/__dist__"),
    emptyOutDir: true,
  },
});
