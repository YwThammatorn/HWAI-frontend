/** "C1 · Program correctness / ความถูกต้องของโปรแกรม" → code C1, main name, second-language name.
 *  A name typed freely by a teacher has no code and no second name. */
export function splitCriterionName(full: string): { code?: string; main: string; second?: string } {
  const m = full.match(/^(C\d+) · (.+)$/);
  const rest = m ? m[2] : full;
  const i = rest.indexOf(" / ");
  return { code: m?.[1], main: i > 0 ? rest.slice(0, i) : rest, second: i > 0 ? rest.slice(i + 3) : undefined };
}
