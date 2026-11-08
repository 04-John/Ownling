// The "before money moves" block: from, to, amounts and result, placed right above the button.
// Amounts and accounts are mono; on testnet, amounts read "testnet NEAR".
import { Fragment, type ReactNode } from 'react';
import { fmtNear } from '../lib/format';

export type MoneyRow = { label: string; value: ReactNode; mono?: boolean; strong?: boolean };

export function MoneyDetails({ rows, label = 'What happens' }: { rows: MoneyRow[]; label?: string }) {
  return (
    <dl className="money" aria-label={label}>
      {rows.map((r) => (
        <Fragment key={r.label}>
          <dt>{r.label}</dt>
          <dd className={[r.mono && 'mono', r.strong && 'strong'].filter(Boolean).join(' ') || undefined}>{r.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

/** "0.1 testnet NEAR" in mono. */
export function TestnetNear({ amount }: { amount: number | null | undefined }) {
  return <span className="mono">{fmtNear(amount)} testnet NEAR</span>;
}
