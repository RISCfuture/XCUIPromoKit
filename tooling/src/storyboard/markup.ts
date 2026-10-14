/** A stretch of copy, set plainly or with emphasis. */
export type Run = { text: string; emphasis: boolean };

/**
 * Splits copy into runs, setting text between a pair of asterisks, as in `Every fix, *corrected*.`,
 * with emphasis. An asterisk without a partner is kept as written.
 */
export function runs(copy: string): Run[] {
  const parts = copy.split(/\*([^*]+)\*/);
  return parts
    .map((text, index) => ({ text, emphasis: index % 2 === 1 }))
    .filter(({ text }) => text.length > 0);
}

/** Copy as a reader sees it, without its emphasis marks. */
export function plainText(copy: string): string {
  return runs(copy)
    .map(({ text }) => text)
    .join('');
}

/**
 * Cuts copy's runs into `pieces` of its plain text, in order, so each piece keeps the emphasis of
 * each stretch of it. The pieces must make up the plain text exactly.
 */
export function piecesOfRuns(copy: string, pieces: string[]): Run[][] {
  const remaining = runs(copy);
  return pieces.map((piece) => {
    const cut: Run[] = [];
    let needed = piece.length;
    while (needed > 0) {
      const run = remaining[0];
      if (!run) throw new Error('The pieces run past the copy');
      const text = run.text.slice(0, needed);
      cut.push({ text, emphasis: run.emphasis });
      needed -= text.length;
      if (text.length === run.text.length) remaining.shift();
      else remaining[0] = { ...run, text: run.text.slice(text.length) };
    }
    return cut;
  });
}
