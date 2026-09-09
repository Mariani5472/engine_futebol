import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@match-engine/core": fileURLToPath(new URL("../engine/src/index.ts", import.meta.url)),
    },
  },
});
