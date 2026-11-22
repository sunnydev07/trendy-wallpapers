import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

// Node ESM needs the extension for Next's navigation entry point.
registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === "next/navigation" ? "next/navigation.js" : specifier, context);
  },
});
const { updateFilterQuery } = await import("../src/components/FilterBar.tsx");

test("rapid source and device edits retain both filters and the search query", () => {
  let pending = "q=vice";
  pending = updateFilterQuery(pending, "source", "human");
  pending = updateFilterQuery(pending, "device", "mobile");
  assert.equal(pending, "q=vice&source=human&device=mobile");
});

test("a later selection replaces the pending value for the same filter", () => {
  let pending = updateFilterQuery("device=desktop", "source", "human");
  pending = updateFilterQuery(pending, "source", "ai");
  assert.equal(pending, "device=desktop&source=ai");
});

for (const key of ["textless", "oled"]) {
  test(`rapid ${key} toggles use the pending value`, () => {
    let pending = updateFilterQuery("source=ai", key, "1", true);
    assert.equal(pending, `source=ai&${key}=1`);
    pending = updateFilterQuery(pending, key, "1", true);
    assert.equal(pending, "source=ai");
  });
}

test("color toggles match URL colors regardless of case", () => {
  assert.equal(updateFilterQuery("color=%23ff2e93&oled=1", "color", "#FF2E93", true), "oled=1");
  assert.equal(updateFilterQuery("color=%23FF2E93", "color", "#00F0FF", true), "color=%2300F0FF");
});

test("default selections remove only their own filter", () => {
  for (const value of ["all", "0", "", null]) {
    assert.equal(updateFilterQuery("source=human&device=mobile", "device", value), "source=human");
  }
});

test("edits can start from reset or history-restored URL state", () => {
  assert.equal(updateFilterQuery("", "device", "desktop"), "device=desktop");
  assert.equal(updateFilterQuery("source=human&sort=views", "device", "mobile"), "source=human&sort=views&device=mobile");
});

test("changing a filter or sort clears the current page", () => {
  assert.equal(
    new URLSearchParams(updateFilterQuery("page=3&source=ai", "device", "mobile")).has("page"),
    false
  );
  assert.equal(
    new URLSearchParams(updateFilterQuery("page=3&device=mobile", "sort", "views")).has("page"),
    false
  );
  assert.equal(
    new URLSearchParams(updateFilterQuery("page=3&device=mobile", "q", "neon")).has("page"),
    false
  );
  assert.equal(updateFilterQuery("page=3", "page", "2"), "page=2");
});
