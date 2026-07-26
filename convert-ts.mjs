/**
 * Bulk TypeScript → JavaScript conversion script.
 * Uses @babel/preset-typescript to strip type annotations while leaving all
 * runtime logic untouched. TSX files become JSX (Vite processes JSX at build
 * time, so we intentionally do NOT run @babel/preset-react here).
 */
import { transformSync } from "@babel/core";
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { execSync } from "child_process";
import path from "path";

const WORKSPACE = "/home/runner/workspace";

// Directories to skip entirely
const SKIP = [
  "node_modules",
  "dist",
  ".replit-artifact",
  "attached_assets",
  ".local",
  ".agents",
];

const skipPattern = SKIP.map((d) => `-not -path "*/${d}/*"`).join(" ");

const findCmd = `find ${WORKSPACE} ${skipPattern} \\( -name "*.ts" -o -name "*.tsx" \\) -print`;

const files = execSync(findCmd, { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

console.log(`Found ${files.length} TypeScript files to convert.\n`);

let ok = 0;
let fail = 0;

for (const file of files) {
  try {
    const src = readFileSync(file, "utf8");
    const isJSX = file.endsWith(".tsx");

    const result = transformSync(src, {
      filename: file,
      presets: ["@babel/preset-typescript"],
      // For TSX: add JSX syntax plugin so Babel can parse JSX without transforming it.
      // Vite handles JSX transformation at build time; we just want type stripping here.
      plugins: isJSX ? ["@babel/plugin-syntax-jsx"] : [],
      // Retain original line numbers so stack traces stay meaningful
      retainLines: true,
      sourceType: "module",
      // Don't add any polyfills or helpers
      configFile: false,
      babelrc: false,
    });

    const jsFile = isJSX
      ? file.replace(/\.tsx$/, ".jsx")
      : file.replace(/\.ts$/, ".js");

    writeFileSync(jsFile, result.code, "utf8");
    if (jsFile !== file) {
      unlinkSync(file);
    }

    const rel = path.relative(WORKSPACE, file);
    const relOut = path.relative(WORKSPACE, jsFile);
    console.log(`✓  ${rel}  →  ${relOut}`);
    ok++;
  } catch (err) {
    console.error(`✗  ${file}: ${err.message}`);
    fail++;
  }
}

console.log(`\nDone: ${ok} converted, ${fail} failed.`);
