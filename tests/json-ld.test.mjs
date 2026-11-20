import assert from "node:assert/strict";
import test from "node:test";
import { serializeJsonLd } from "../src/lib/json-ld.ts";

test("JSON-LD escaping neutralizes user content that closes the script tag", () => {
  const payload = {
    "@type": "ImageObject",
    description: 'Inspired by "</script><img src=x onerror=alert(1)>"',
  };

  const serialized = serializeJsonLd(payload);

  assert.equal(serialized.includes("<"), false, "no raw angle bracket may survive");
  assert.equal(serialized.includes("</script>"), false);
  assert.deepEqual(JSON.parse(serialized), payload, "escaping must keep valid JSON");
});

test("JSON-LD escaping covers every less-than, not only script sequences", () => {
  assert.equal(serializeJsonLd({ name: "a < b < c" }), '{"name":"a \\u003c b \\u003c c"}');
});
