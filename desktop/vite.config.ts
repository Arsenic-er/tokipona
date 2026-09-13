import { defineConfig } from "vite";
import { createTokiponaViteConfig } from "../vite.config";

// Local QA only: never enable candidate assets in the public production build.
const config = createTokiponaViteConfig();
export default defineConfig({
  ...config,
  define: { ...config.define, __TOKIPONA_LOCAL_DESKTOP__: "true" },
  build: { ...config.build, outDir: "exports/windows/.build/web" },
});
