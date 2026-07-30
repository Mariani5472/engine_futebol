import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@match-engine/runtime": fileURLToPath(new URL("../engine/src/application/match/runtime/index.ts", import.meta.url)),
    },
  },
});
