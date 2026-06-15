import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
// @ts-ignore
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf-8"));

export default defineConfig({
  main: {
    // The MCP SDK (and zod) are ESM-only / dual packages. The main process is
    // emitted as CommonJS, so we must let Vite bundle them in rather than
    // externalize them (a bare require() of the ESM-only SDK would fail).
    plugins: [
      externalizeDepsPlugin({
        exclude: ["@modelcontextprotocol/sdk", "zod"],
      }),
    ],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src"),
      },
    },
    plugins: [react(), tailwindcss()],
  },
});
