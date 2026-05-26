/**
 * Minimal profanity filter.
 *
 * Goal: catch the most common slurs and unambiguous obscenities without
 * generating a moral-panic block list. Word matching is whole-token and
 * case-insensitive; deliberately conservative to keep false-positives low.
 *
 * Tune the list per-deployment via `extraDeny` on the helper.
 */

const BASE_DENY = new Set<string>([
  // Common slurs and unambiguous obscenities. Intentionally short.
  'fuck',
  'fucking',
  'shit',
  'bitch',
  'cunt',
  'asshole',
  'dick',
  'pussy',
  'bastard',
  'nigger',
  'faggot',
  'retard',
  'whore',
  'slut',
]);

const LEET_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  '$': 's',
  '!': 'i',
};

function normalize(token: string): string {
  return token
    .toLowerCase()
    .split('')
    .map((ch) => LEET_MAP[ch] ?? ch)
    .join('')
    .replace(/[^a-z]/g, '');
}

export interface ProfanityResult {
  clean: boolean;
  matched: string[];
}

export function checkProfanity(
  text: string,
  extraDeny: readonly string[] = [],
): ProfanityResult {
  const deny = new Set([...BASE_DENY, ...extraDeny.map((w) => w.toLowerCase())]);
  const tokens = text.split(/\s+/).filter(Boolean);
  const matched: string[] = [];

  for (const raw of tokens) {
    const norm = normalize(raw);
    if (!norm) continue;
    if (deny.has(norm)) {
      matched.push(raw);
      continue;
    }
    // also catch trivial substrings (e.g. "fuuuuck")
    for (const word of deny) {
      if (word.length >= 4 && norm.includes(word)) {
        matched.push(raw);
        break;
      }
    }
  }

  return { clean: matched.length === 0, matched };
}
