/**
 * Decodes common and numeric HTML entities (e.g. &quot;, &#39;, &amp;, &lt;, &gt;)
 * into standard characters.
 */
export function decodeHtmlEntities(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/")
    .replace(/&#34;/g, '"')
    .replace(/&#38;/g, "&")
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCharCode(Number(dec));
      } catch {
        return _;
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return _;
      }
    });
}
