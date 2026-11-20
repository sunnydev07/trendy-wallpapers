import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../src/app/api/views/route.ts";
import { getDemoWallpapers, SEED_WALLPAPERS } from "../src/lib/seed-data.ts";

const wallpaper = SEED_WALLPAPERS[0];

function beacon(payload) {
  return POST(
    new Request("http://localhost:3000/api/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  );
}

function uniqueVisitorId() {
  return `route-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function demoViews(wallpaperId = wallpaper.id) {
  return getDemoWallpapers().find((item) => item.id === wallpaperId).views_count;
}

test("views endpoint counts the first visit and suppresses the same visitor's repeat", async () => {
  const visitorId = uniqueVisitorId();
  const before = demoViews();

  const first = await beacon({ id: wallpaper.id, visitorId });
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { counted: true });
  assert.equal(demoViews(), before + 1);

  const repeat = await beacon({ id: wallpaper.id, visitorId });
  assert.equal(repeat.status, 200);
  assert.deepEqual(await repeat.json(), { counted: false });
  assert.equal(demoViews(), before + 1);
});

test("views endpoint counts each distinct visitor separately", async () => {
  const before = demoViews();

  const first = await beacon({ id: wallpaper.id, visitorId: uniqueVisitorId() });
  const second = await beacon({ id: wallpaper.id, visitorId: uniqueVisitorId() });

  assert.deepEqual(await first.json(), { counted: true });
  assert.deepEqual(await second.json(), { counted: true });
  assert.equal(demoViews(), before + 2);
});

test("views endpoint rejects malformed requests without counting", async () => {
  const before = demoViews();

  const missingId = await beacon({ visitorId: uniqueVisitorId() });
  assert.equal(missingId.status, 400);

  const invalidJson = await POST(
    new Request("http://localhost:3000/api/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    })
  );
  assert.equal(invalidJson.status, 400);

  assert.equal(demoViews(), before);
});
