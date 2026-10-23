export type GradedCard = {
  answer: string;
  accept: readonly string[];
  strict?: boolean;
};

/** Fold student wording into a comparable token string. */
export function norm(input: string): string {
  let text = input.toLowerCase();
  text = text.replace(/coenzyme\s*a/g, "coa");
  text = text.replace(/acetyl\s*[- ]?\s*co\s*-?\s*a/g, "acetyl coa");
  text = text.replace(/fad\s*h\s*2/g, "fadh2");
  text = text.replace(/nad\s*h/g, "nadh");
  text = text.replace(/nad\s*\+/g, "nad+");
  text = text.replace(/fad\s*\+/g, "fad+");
  text = text.replace(/[₀-₉]/g, (digit) => String("₀₁₂₃₄₅₆₇₈₉".indexOf(digit)));
  text = text.replace(/[^a-z0-9+]+/g, " ");
  return text.replace(/\s+/g, " ").trim();
}

function hasPhrase(given: string, target: string): boolean {
  return ` ${given} `.includes(` ${target} `);
}

export function gradeRecall(input: string, card: GradedCard): boolean {
  const given = norm(input);
  if (!given) return false;
  const targets = [card.answer, ...card.accept].map(norm).filter((item) => item.length > 0);
  if (targets.some((target) => target === given)) return true;
  // Short targets stay exact so "2" cannot ride along inside "32".
  return targets.some((target) => target.length >= 8 && hasPhrase(given, target));
}
