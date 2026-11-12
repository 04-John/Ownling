// Where Mochi takes you when you ask it for something ("can I feed you?", "let's play catch the
// rain"). The mind only names the action; the app decides the screen. Feeding opens the food bowl
// with the portion you named, and nothing is paid until you tap Feed there.
import { GAMES } from '../../../shared/mind';
import type { PetAction } from './types';

export type ActionTarget = {
  /** The button under Mochi's reply: "Open the food bowl", "Play Catch the rain". */
  label: string;
  /** What voice chat shows while Mochi says it: "Opening the food bowl…". */
  going: string;
  route: string;
};

export function actionTarget(action: PetAction, petName: string): ActionTarget {
  if (action.kind === 'feed') {
    return {
      label: `Open ${petName}'s food bowl`,
      going: `Opening ${petName}'s food bowl. You choose the portion and tap Feed.`,
      route: action.portion ? `/feed?portion=${action.portion}` : '/feed',
    };
  }
  if (action.kind === 'dress') return { label: 'Open the wardrobe', going: 'Opening the wardrobe…', route: '/wardrobe' };
  const quick = { rain: 'Catch the rain', tune: `${petName}'s tune`, echo: 'Echo' } as const;
  const game = action.game;
  const title = game in quick ? quick[game as keyof typeof quick] : GAMES[game as keyof typeof GAMES].title;
  const route = game in quick ? `/${game}` : `/talk?game=${game}`;
  return { label: `Play ${title}`, going: `Opening ${title}…`, route };
}
