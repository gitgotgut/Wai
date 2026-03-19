import * as esbuild from "esbuild";

const isWatch = process.argv.includes("--watch");
const isProduction = process.env.NODE_ENV === "production";

/** @type {esbuild.BuildOptions} */
const extensionConfig = {
  entryPoints: ["src/extension/extension.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  external: ["vscode"],
  outfile: "dist/extension.js",
  sourcemap: !isProduction,
  minify: isProduction,
  logLevel: "info",
};

/** @type {esbuild.BuildOptions} */
const webviewConfig = {
  entryPoints: ["src/webview/index.tsx"],
  bundle: true,
  platform: "browser",
  target: "es2020",
  format: "iife",
  outfile: "media/dashboard.js",
  sourcemap: !isProduction,
  minify: isProduction,
  jsx: "automatic",
  logLevel: "info",
};

async function build() {
  try {
    if (isWatch) {
      const extCtx = await esbuild.context(extensionConfig);
      const webCtx = await esbuild.context(webviewConfig);
      await Promise.all([extCtx.watch(), webCtx.watch()]);
      console.log("[wai] Watching for changes...");
    } else {
      await Promise.all([
        esbuild.build(extensionConfig),
        esbuild.build(webviewConfig),
      ]);
      console.log("[wai] Build complete.");
    }
  } catch (err) {
    console.error("[wai] Build failed:", err);
    process.exit(1);
  }
}

build();
