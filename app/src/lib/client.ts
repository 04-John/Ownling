// The app's only door to accounts, the chain, the kitchen and the diary. Screens call these
// methods and never talk to NEAR or the kitchen directly. Every method that moves money or
// changes the pet resolves only after the transaction is final, and throws an Error whose
// message is safe to show (sentence case, no apology).
import type { Account, AppConfig, ChatTurn, DiaryView, PetState, Proof } from './types';

export interface OwnlingClient {
  readonly config: AppConfig;

  /** The signed-in account, or null. */
  account(): Account | null;
  /** Make a key in this browser, create a named testnet account with starter funds, sign in. */
  createAccount(): Promise<{ account: Account; recoveryPhrase: string }>;
  /** Sign in on this device with a saved 12-word recovery phrase. */
  restore(recoveryPhrase: string): Promise<Account>;
  /** The recovery phrase for a 'local' account, to show again on request. */
  recoveryPhrase(): string | null;
  signOut(): void;

  /** The signed-in account's pet, or null if it hasn't adopted one. */
  myPet(): Promise<PetState | null>;
  /** Adopt: the deposit pays storage (about 0.01 NEAR) and the rest becomes food. */
  adopt(name: string, depositNear: number): Promise<PetState>;
  feed(amountNear: number): Promise<PetState>;
  play(): Promise<PetState>;

  /** Send a message; resolves with Mochi's reply, its proof and the pet after the charge. */
  talk(message: string): Promise<{ reply: ChatTurn; proof: Proof; pet: PetState }>;
  /** This session's conversation, oldest first. */
  history(): ChatTurn[];

  diary(): Promise<DiaryView>;
  unlockDiary(): Promise<DiaryView>;
  lockDiary(): void;

  changeKitchen(kitchenId: string): Promise<PetState>;
  /** Transfer the pet. Its food goes with it; this owner's diary stays behind. */
  give(receiverId: string): Promise<void>;
}
