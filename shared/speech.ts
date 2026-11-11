// Clean-up for speech-to-text results, shared by the kitchen and its tests.

/**
 * Whisper often misspells a pet's name ("Moshi" for "Mochi") and ignores the spelling hint. A
 * capitalized word one letter away from the name becomes the name; ordinary words are left alone.
 */
export function fixName(text: string, name?: string): string {
  if (!name || name.length < 4 || /\s/.test(name)) return text;
  const target = name.toLowerCase();
  return text.replace(/\p{Lu}\p{L}+/gu, (word) =>
    word.toLowerCase() !== target && editDistance(word.toLowerCase(), target) === 1 ? name : word,
  );
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[b.length];
}
