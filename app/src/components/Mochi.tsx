// Mochi, drawn by the design's renderer. The SVG carries role="img" and an aria-label such as
// "Mochi, child, content, talking", rebuilt whenever state changes. renderMochi only emits its own
// constants plus the enum values passed in (and escapes the name), so the inner HTML is safe.
import { useMemo } from 'react';
import { renderMochi, type Moment } from '../../../design/mochi/mochi';
import { outfitSvg } from '../../../shared/wardrobe';
import type { Mood, Stage } from '../lib/types';

type Props = {
  stage: Stage;
  mood: Mood;
  moment?: Moment;
  size: number;
  name?: string;
  className?: string;
  /** Wardrobe item ids to wear (shared/wardrobe.ts). */
  outfit?: readonly string[];
};

export function Mochi({ stage, mood, moment = 'none', size, name, className, outfit }: Props) {
  // Mood wins over moments when hibernating: a sleeping Mochi can't play or talk.
  const shown: Moment = mood === 'hibernating' ? 'none' : moment;
  const outfitKey = outfit?.join(',') ?? '';
  const html = useMemo(
    () => renderMochi({ stage, mood, moment: shown, size, name, dress: outfitKey ? outfitSvg(stage, outfitKey.split(',')) : undefined }),
    [stage, mood, shown, size, name, outfitKey],
  );
  return (
    <div
      className={className ? `mochi ${className}` : 'mochi'}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export type { Moment };
