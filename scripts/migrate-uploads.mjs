#!/usr/bin/env node
/**
 * One-time migration for demo uploads written before originals/thumbnails were split
 * into separate directories. It reads `.demo-wallpapers.json`, moves each referenced
 * flat file into `.uploads/originals/` or `.uploads/thumbs/`, and leaves every other
 * file untouched. Run it deliberately; it is never invoked automatically.
 *
 *   node scripts/migrate-uploads.mjs            # dry run
 *   node scripts/migrate-uploads.mjs --apply    # perform the moves
 */
import { copyFile, mkdir, readFile, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";

const apply = process.argv.includes("--apply");
const root = process.env.DEMO_UPLOAD_DIR?.trim() || path.join(process.cwd(), ".uploads");
const storePath = process.env.DEMO_WALLPAPER_STORE?.trim() || path.join(process.cwd(), ".demo-wallpapers.json");

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  let records = [];
  try {
    const parsed = JSON.parse(await readFile(storePath, "utf8"));
    if (Array.isArray(parsed)) records = parsed;
  } catch {
    console.log(`No demo store found at ${storePath}; nothing to migrate.`);
    return;
  }

  const moves = [];
  for (const record of records) {
    for (const key of [record.r2_original_key, record.r2_thumb_key]) {
      if (typeof key !== "string") continue;
      const [prefix, ...rest] = key.replace(/^\/+/, "").split("/");
      if (prefix !== "originals" && prefix !== "thumbs") continue;
      const name = path.basename(rest.join("/"));
      const source = path.join(root, name);
      const target = path.join(root, prefix, name);
      if (source === target) continue;
      if (!(await exists(source)) || (await exists(target))) continue;
      moves.push({ source, target });
    }
  }

  if (moves.length === 0) {
    console.log("No legacy flat uploads need migration.");
    return;
  }

  for (const { source, target } of moves) {
    console.log(`${apply ? "move" : "would move"} ${path.relative(process.cwd(), source)} -> ${path.relative(process.cwd(), target)}`);
    if (!apply) continue;
    await mkdir(path.dirname(target), { recursive: true });
    try {
      await rename(source, target);
    } catch {
      // Cross-device fallback keeps the destination atomic per file.
      await copyFile(source, target);
      await unlink(source);
    }
  }

  console.log(apply ? `Migrated ${moves.length} file(s).` : `Dry run: ${moves.length} file(s) would move. Re-run with --apply.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
