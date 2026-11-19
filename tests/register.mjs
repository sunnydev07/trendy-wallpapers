import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import ts from "typescript";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) specifier = pathToFileURL(path.resolve("src", specifier.slice(2))).href;
    try { return nextResolve(specifier, context); } catch (error) {
      if (specifier.startsWith("next/")) {
        try { return nextResolve(`${specifier}.js`, context); } catch { /* fall through */ }
      }
      if (specifier.startsWith(".") || specifier.startsWith("file:")) {
        const url = new URL(specifier, context.parentURL);
        for (const extension of [".ts", ".tsx"]) {
          if (existsSync(fileURLToPath(url) + extension)) return { url: url.href + extension, shortCircuit: true };
        }
      }
      throw error;
    }
  },
  load(url, context, nextLoad) {
    if (/\.tsx?$/.test(url)) {
      const source = ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
        fileName: fileURLToPath(url),
      }).outputText;
      return { format: "module", source, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
