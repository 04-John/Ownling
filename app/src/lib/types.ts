// The shapes the screens work with. The real client fills them from the chain, the kitchen and
// the diary; the mock client fills them with sample data. Amounts are in NEAR, times in ms.
import type { Mood, Stage } from '../../../design/mochi/mochi';
import type { GameId } from '../../../shared/mind';

export type { GameId, Mood, Stage };

export type PetState = {
  tokenId: string;
  name: string;
  species: string;
  ownerId: string;
  stage: Stage;
  mood: Mood;
  /** Messages answered + times played. */
  growthPoints: number;
  messages: number;
  bond: number;
  foodNear: number;
  dailyCapNear: number;
  spentTodayNear: number;
  /** Days of thinking left at the full daily cap; null when unknown (show "—"). */
  runwayDays: number | null;
  hibernating: boolean;
  hasDiary: boolean;
  kitchen: string;
  model: string;
  contractId: string;
  /** When the next bond point can be earned; null when it can now. */
  playReadyAt: number | null;
  /** Wardrobe item ids the pet wears, stored with the NFT (shared/wardrobe.json). */
  outfit: string[];
};

export type ProofStatus = 'verified' | 'pending' | 'none';

export type Proof = {
  status: ProofStatus;
  model: string;
  costNear: number;
  /** sha256 of the signed reply, recorded on-chain with the charge. */
  receiptHash?: string;
  signer?: string;
  signatureKind?: 'provider_tee' | 'gateway';
};

export type ChatTurn = {
  role: 'user' | 'assistant';
  content: string;
  at: number;
  /** Only on Mochi's replies. */
  proof?: Proof;
  /** Facts about the owner this reply added to the diary. */
  learned?: string[];
  /** Set on the reply that ended a game round. */
  result?: 'win' | 'lose';
};

/** A game round in progress. `thing` is the secret in "Guess my thing". */
export type ActiveGame = { id: GameId; thing?: string };

/** What every kind of thought returns: Mochi's reply and the pet after the charge. */
export type TalkResult = {
  reply: ChatTurn;
  proof: Proof;
  pet: PetState;
  learned: string[];
  result: 'win' | 'lose' | null;
};

export type DiaryView = {
  locked: boolean;
  facts: string[];
  recent: ChatTurn[];
  updatedAt: string | null;
  /** Size of the encrypted diary stored on-chain, in bytes. */
  sizeBytes: number | null;
};

export type Account = {
  accountId: string;
  /** 'local' = key made in this browser (no wallet); 'wallet' = a NEAR wallet via NEAR Connect. */
  kind: 'local' | 'wallet';
};

export type AppConfig = {
  network: 'testnet';
  contractId: string;
  kitchenId: string;
  kitchenUrl: string;
  /** True when the kitchen replies without NEAR AI (no proof, tiny charge). */
  practiceMode: boolean;
};
