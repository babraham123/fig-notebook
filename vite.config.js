import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { cssModulesPlugin } from "./build/vendor/css-module-plugin.mjs";

import * as path from "path";
import { fileURLToPath } from "url";

const config = defineConfig({
  root: "./src",
  build: {
    outDir: "../dist/" + process.env.VITE_TARGET,
    emptyOutDir: true,
  },
  plugins: [viteSingleFile(), cssModulesPlugin()],
  resolve: {
    alias: {},
  },
});

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Stub it out when not needed
 if (process.env.VITE_TARGET !== "editor") {
  config.resolve.alias["prettier"] = path.join(
    dirname,
    "build",
    "fake-prettier.mjs"
  );
}

export default config;
