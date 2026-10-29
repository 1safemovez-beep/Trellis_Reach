// Pulls the readable ad copy out of a saved script.
export function adCopy(body: string) {
  const main = body.split(/\n\s*SHOT LIST/i)[0];
  return main.replace(/^\s*(\[[^\]]*\]|\([^)]*\)|[A-Z][A-Z /&-]{2,}:)\s*/gm, "").replace(/\n{2,}/g, "\n").trim();
}
