import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const loader = new URL("./register.mjs", import.meta.url).href;
const source = new URL("../src/lib/seed-data.ts", import.meta.url).href;
test("registered demo wallpapers survive a fresh server process", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "trendy-persistence-"));
  const run = (code) => {
    const result = spawnSync(process.execPath, ["--import", loader, "--input-type=module", "-e", code], { cwd, encoding: "utf8", timeout: 15000 });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  try {
    run(`const m=await import(${JSON.stringify(source)}); await m.registerDemoWallpaper({...m.SEED_WALLPAPERS[0],id:'d14aed59-a6db-4db4-84aa-e419fbff90f9',slug:'persisted-test',tags:['cyberpunk-rain']});`);
    const found = run(`const m=await import(${JSON.stringify(source)}); console.log(m.getDemoWallpapers().some(w=>w.slug==='persisted-test'));`);
    assert.equal(found, "true");
  } finally { await rm(cwd, { recursive: true, force: true }); }
});

test("demo persistence keeps every record in the in-memory window", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "trendy-retention-"));
  const run = (code) => {
    const result = spawnSync(process.execPath, ["--import", loader, "--input-type=module", "-e", code], { cwd, encoding: "utf8", timeout: 30000 });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  try {
    run(`const m=await import(${JSON.stringify(source)}); const p=m.SEED_WALLPAPERS[0]; for(let i=0;i<55;i+=1){await m.registerDemoWallpaper({...p,id:'retention-'+i,slug:'retention-'+i,tags:[]});}`);
    const summary = run(
      `const fs=await import('node:fs'); const disk=JSON.parse(fs.readFileSync('.demo-wallpapers.json','utf8')); const probes=disk.filter(w=>w.slug.startsWith('retention-')); console.log(probes.length, probes.some(w=>w.slug==='retention-0'));`
    );
    assert.equal(summary, "55 true");
  } finally { await rm(cwd, { recursive: true, force: true }); }
});
