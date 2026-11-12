// Shared pieces of the quick games: the top bar, best scores kept on this device, and the screen a
// hibernating Mochi shows instead of a game.
import type { ReactNode } from 'react';
import type { PetState } from '../lib/types';
import { BackButton } from './ui';

export function ArcadeBar({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="topbar">
      <BackButton to="/play" />
      <span className="eyebrow">{title.toUpperCase()}</span>
      {children ?? <span className="topbar__spacer" />}
    </div>
  );
}

const bestKey = (game: string, pet: PetState) => `ownling.best.${game}.${pet.tokenId}`;

export function loadBest(game: string, pet: PetState): number {
  try {
    return Number(localStorage.getItem(bestKey(game, pet))) || 0;
  } catch {
    return 0;
  }
}

/** Saves the score if it beats the best; returns true for a new best. */
export function saveBest(game: string, pet: PetState, score: number): boolean {
  if (score <= loadBest(game, pet)) return false;
  try {
    localStorage.setItem(bestKey(game, pet), String(score));
  } catch {
    /* private window: the best lasts for this visit */
  }
  return true;
}

export function Asleep({ pet, title }: { pet: PetState; title: string }) {
  return (
    <main className="screen">
      <ArcadeBar title={title} />
      <h1 className="title" tabIndex={-1}>
        {pet.name} is hibernating
      </h1>
      <p className="body-text">Feed it first, then you can play.</p>
      <a className="btn btn--primary" href="#/feed">
        Feed {pet.name}
      </a>
    </main>
  );
}
