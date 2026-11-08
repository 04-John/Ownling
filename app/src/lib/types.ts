// The shapes the screens work with. The real client fills them from the chain, the kitchen and
// the diary; the mock client fills them with sample data. Amounts are in NEAR, times in ms.
import type { Mood, Stage } from '../../../design/mochi/mochi';

export type { Mood, Stage };

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
  /** When Play is available again; null when it is now. */
  playReadyAt: number | null;
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
