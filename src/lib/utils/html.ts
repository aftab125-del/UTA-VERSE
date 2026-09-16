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

/**
 * Cleans track titles by decoding HTML entities, stripping redundant artist prefixes,
 * and removing stray enclosing quotes.
 */
export function cleanTrackTitle(title: string | null | undefined, artist?: string | null): string {
  if (!title) return "Unknown Track";
  let decoded = decodeHtmlEntities(title).trim();

  if (artist) {
    const decodedArtist = decodeHtmlEntities(artist).trim();
    if (decodedArtist) {
      // Remove leading "Artist - " or "Artist: " or "Artist | "
      const escapedArtist = decodedArtist.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const prefixRegex = new RegExp(`^${escapedArtist}\\s*[-–—:|•]+\\s*`, "i");
      decoded = decoded.replace(prefixRegex, "").trim();

      // Handle cases like: Dominic Fike "Babydoll"
      const quotePrefixRegex = new RegExp(`^${escapedArtist}\\s+["'](.+)["']$`, "i");
      const quoteMatch = decoded.match(quotePrefixRegex);
      if (quoteMatch && quoteMatch[1]) {
        decoded = quoteMatch[1].trim();
      }
    }
  }

  // Strip enclosing quotes: "Babydoll" -> Babydoll
  if (
    (decoded.startsWith('"') && decoded.endsWith('"')) ||
    (decoded.startsWith("'") && decoded.endsWith("'")) ||
    (decoded.startsWith("“") && decoded.endsWith("”"))
  ) {
    decoded = decoded.slice(1, -1).trim();
  }

  return decoded || decodeHtmlEntities(title).trim() || "Unknown Track";
}
