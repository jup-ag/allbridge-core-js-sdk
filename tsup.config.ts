import type { Options } from "tsup";

const config: Options = {
  entry: ["src/index.ts"],
  format: ["esm"],
  splitting: true,
  sourcemap: true,
  minify: false,
  clean: true,
  skipNodeModulesBundle: true,
  dts: true,
  treeshake: true,
  external: ["node_modules"],
};

export default config;
