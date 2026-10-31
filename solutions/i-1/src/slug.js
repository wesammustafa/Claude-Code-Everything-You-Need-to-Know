// Part of linkcheck.
// The anchor GitHub gives a Markdown heading: lowercase, with punctuation
// dropped and spaces turned into hyphens.
export function slugify(heading) {
  return heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
}
