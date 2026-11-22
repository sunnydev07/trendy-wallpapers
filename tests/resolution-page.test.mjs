import assert from "node:assert/strict";
import test from "node:test";
import ResolutionPage from "../src/app/resolution/[res]/page.tsx";
import { getAllResolutions, queryWallpapers } from "../src/lib/data-provider.ts";

const DEVICES = ["desktop", "ultrawide", "mobile"];

/** Walks the server element tree to the grid's wallpaper prop without rendering. */
function findGridWallpapers(node) {
  if (!node || typeof node !== "object") return null;

  const props = node.props ?? {};
  if (Array.isArray(props.wallpapers)) return props.wallpapers;

  const children = Array.isArray(props.children) ? props.children.flat(Infinity) : [props.children];
  for (const child of children) {
    const found = findGridWallpapers(child);
    if (found) return found;
  }
  return null;
}

test("resolution pages forward the device filter to the wallpaper grid", async () => {
  let fixture = null;
  for (const resolution of getAllResolutions()) {
    const all = (await queryWallpapers({ resolution: resolution.slug })).items;
    for (const device of DEVICES) {
      const filtered = (await queryWallpapers({ resolution: resolution.slug, device })).items;
      if (filtered.length > 0 && filtered.length < all.length) {
        fixture = { resolution, device, all, filtered };
        break;
      }
    }
    if (fixture) break;
  }
  assert.ok(fixture, "expected a resolution page with a mix of device types");

  const element = await ResolutionPage({
    params: Promise.resolve({ res: fixture.resolution.slug }),
    searchParams: Promise.resolve({ device: fixture.device }),
  });
  const wallpapers = findGridWallpapers(element);

  assert.ok(wallpapers, "resolution page should render a wallpaper grid");
  assert.deepEqual(
    wallpapers.map((wallpaper) => wallpaper.id),
    fixture.filtered.map((wallpaper) => wallpaper.id)
  );
  assert.notDeepEqual(
    wallpapers.map((wallpaper) => wallpaper.id),
    fixture.all.map((wallpaper) => wallpaper.id)
  );
});
