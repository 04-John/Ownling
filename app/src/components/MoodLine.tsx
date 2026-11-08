// Status is a dot plus words: "Content · Child".
import type { Mood, Stage } from '../lib/types';
import { moodLabel, stageLabel } from '../lib/format';

export function MoodLine({ mood, stage }: { mood: Mood; stage: Stage }) {
  return (
    <div className="mood-line">
      <span className={`dot dot--${mood}`} aria-hidden="true" />
      {moodLabel(mood)} · {stageLabel(stage)}
    </div>
  );
}
