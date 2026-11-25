import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/pdf.worker*.mjs",
    "public/pdf*.mjs",
    // Folder lain di direktori induk yang bukan bagian repo ini.
    "mockup/**",
    "tabungan-nikah/**",
  ]),
]);

export default eslintConfig;
