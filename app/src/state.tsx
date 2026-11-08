// App-wide state: the client, the signed-in account and its pet. Screens read it with useApp().
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { OwnlingClient } from './lib/client';
import type { Account, PetState } from './lib/types';
import { errorText } from './lib/format';

/** A moment Home should play when it next shows (set by Feed and Wake up before navigating). */
export type Celebration = { kind: 'eat'; fromDays: number | null } | { kind: 'wake' };

type PetStatus = 'idle' | 'loading' | 'ready' | 'error';

type AppState = {
  client: OwnlingClient;
  account: Account | null;
  setAccount: (a: Account | null) => void;
  pet: PetState | null;
  petStatus: PetStatus;
  petError: string | null;
  setPet: (p: PetState | null) => void;
  /** Re-read the pet. Silent reloads keep the current pet on screen while loading. */
  reloadPet: (opts?: { silent?: boolean }) => Promise<PetState | null>;
  /** The phrase from createAccount(), shown once on the recovery screen. */
  freshPhrase: string | null;
  setFreshPhrase: (p: string | null) => void;
  celebration: Celebration | null;
  setCelebration: (c: Celebration | null) => void;
};

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ client, children }: { client: OwnlingClient; children: ReactNode }) {
  const [account, setAccountState] = useState<Account | null>(() => client.account());
  const [pet, setPetState] = useState<PetState | null>(null);
  const [petStatus, setPetStatus] = useState<PetStatus>(() => (client.account() ? 'loading' : 'idle'));
  const [petError, setPetError] = useState<string | null>(null);
  const [freshPhrase, setFreshPhrase] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const loadSeq = useRef(0);

  const setPet = useCallback((p: PetState | null) => {
    setPetState(p);
    setPetStatus('ready');
    setPetError(null);
  }, []);

  const reloadPet = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      const seq = ++loadSeq.current;
      if (!opts.silent) setPetStatus('loading');
      try {
        const p = await client.myPet();
        if (seq === loadSeq.current) setPet(p);
        return p;
      } catch (e) {
        if (seq === loadSeq.current) {
          setPetError(errorText(e));
          if (!opts.silent) setPetStatus('error');
        }
        throw e;
      }
    },
    [client, setPet],
  );

  const setAccount = useCallback(
    (a: Account | null) => {
      setAccountState(a);
      if (!a) {
        setPetState(null);
        setPetStatus('idle');
      }
    },
    [],
  );

  const value = useMemo<AppState>(
    () => ({
      client, account, setAccount, pet, petStatus, petError, setPet, reloadPet,
      freshPhrase, setFreshPhrase, celebration, setCelebration,
    }),
    [client, account, setAccount, pet, petStatus, petError, setPet, reloadPet, freshPhrase, celebration],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}

/** The pet, for screens the router only shows once a pet exists. */
export function usePet(): PetState {
  const { pet } = useApp();
  if (!pet) throw new Error('No pet loaded');
  return pet;
}
