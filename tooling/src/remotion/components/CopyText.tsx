import type { ReactNode } from 'react';
import { piecesOfRuns, plainText, type Run } from '../../storyboard/markup.ts';

/**
 * Copy with its `*emphasis*` set in `.promo-caption-em`. `split`, given, cuts the copy's plain
 * text into units, each rendered by `unit`; emphasis is set inside a unit, so marking a phrase
 * never splits one.
 *
 * The copy is laid out twice in the same place: `.promo-text-stroke` underneath, which carries any
 * text stroke brand.css sets, and `.promo-text-fill` on top, which never strokes. No unit's
 * outline can cover another's letters.
 */
export function CopyText({
  copy,
  split = (text) => [text],
  unit = (content) => content,
}: {
  copy: string;
  split?: (text: string) => string[];
  unit?: (content: ReactNode, index: number) => ReactNode;
}) {
  const pieces = piecesOfRuns(copy, split(plainText(copy)));
  const layer = () => pieces.map((runs, index) => unit(<Runs runs={runs} />, index));
  return (
    <span className="promo-text">
      <span className="promo-text-stroke" aria-hidden>
        {layer()}
      </span>
      <span className="promo-text-fill">{layer()}</span>
    </span>
  );
}

function Runs({ runs }: { runs: Run[] }) {
  return runs.map(({ text, emphasis }, index) =>
    emphasis ? (
      <em key={index} className="promo-caption-em">
        {text}
      </em>
    ) : (
      text
    )
  );
}
