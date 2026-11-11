// The three blocks of the score card that sits at the top of a submission's grading detail AND of the Grading Review screen (10/11/2569, advisor:
// "Now / AI / Saved" on one screen and "Now / AI / Yours" on the other, and "Now" did not say what it meant). One set of words, one place:
//   counts  — the score this work is worth right now: the grader's score once saved, otherwise what the AI suggested
//   ai      — what the AI suggested
//   mine    — what the signed-in grader (teacher or TA) has saved ("—" until they do)
export function scoreBlockLabels(t: (th: string, en: string) => string) {
  return {
    counts: t("คะแนนที่ใช้", "Counts as"),
    ai: t("AI เสนอ", "AI suggested"),
    mine: t("คุณให้", "You gave"),
  };
}
