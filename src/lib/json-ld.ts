/**
 * Serializes JSON-LD for `dangerouslySetInnerHTML`. Plain `JSON.stringify` leaves
 * `<` untouched, so a user-controlled string containing `</script>` would close the
 * script tag early and inject markup into the page. Escaping every `<` as `\u003c`
 * keeps the payload inert while remaining valid JSON.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
