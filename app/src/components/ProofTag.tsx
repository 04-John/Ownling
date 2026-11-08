// The pill under every Mochi reply. "Verified" only when the attestation check passed; practice
// mode always shows "No proof". Tapping opens the details: a plain sentence, cost, model, receipt.
import { useId, useState } from 'react';
import type { Proof, ProofStatus } from '../lib/types';
import { fmtNear, modelLabel, shortHash } from '../lib/format';

export const VERIFY_URL = 'https://docs.near.ai/cloud/verification/verification-center.md';

const LABEL: Record<ProofStatus, string> = { verified: 'Verified', pending: 'Pending', none: 'No proof' };

export function shownStatus(proof: Proof | undefined, practiceMode: boolean): ProofStatus {
  if (practiceMode || !proof) return 'none';
  if (proof.status === 'verified') return 'verified';
  if (proof.status === 'pending') return 'pending';
  return 'none';
}

function sentence(status: ProofStatus, proof: Proof, practiceMode: boolean): string {
  if (practiceMode) {
    return "Practice mode: this reply didn't come from NEAR AI's sealed hardware, so there is no signature to check. Mochi was still charged on NEAR, with a receipt.";
  }
  if (status === 'verified') {
    return proof.signatureKind === 'gateway'
      ? "Answered on NEAR AI. NEAR AI's gateway signed this reply and the signature checked out."
      : 'Answered inside sealed hardware on NEAR AI. The hardware signed this reply and the signature checked out.';
  }
  if (status === 'pending') return 'The reply is here. The signature check is still running.';
  return "This reply's signature couldn't be checked, so it isn't marked verified.";
}

/** A tag that isn't attached to a reply yet (while Mochi is thinking). */
export function StatusTag({ status }: { status: ProofStatus }) {
  return (
    <span className={`proof-tag proof-tag--${status}`}>
      <span className="proof-tag__dot" aria-hidden="true" />
      {LABEL[status]}
    </span>
  );
}

export function ProofTag({ proof, practiceMode }: { proof: Proof | undefined; practiceMode: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const status = shownStatus(proof, practiceMode);
  if (!proof) return <StatusTag status="none" />;

  const pill = (
    <button
      type="button"
      className={`proof-tag proof-tag--${status} proof-tag--button`}
      aria-expanded={open}
      aria-controls={open ? id : undefined}
      onClick={() => setOpen((o) => !o)}
    >
      <span className="proof-tag__dot" aria-hidden="true" />
      {LABEL[status]}
      <span className="sr-only">, proof details</span>
    </button>
  );
  if (!open) return <div className="proof-row">{pill}</div>;

  return (
    <div className="proof-details" id={id}>
      <div className="proof-details__top">
        {pill}
        <a className="proof-details__link" href={VERIFY_URL} target="_blank" rel="noopener noreferrer">
          How to check this
        </a>
      </div>
      <p className="proof-details__text">{sentence(status, proof, practiceMode)}</p>
      <dl className="proof-details__facts">
        <dt>cost</dt>
        <dd>{fmtNear(proof.costNear)} NEAR</dd>
        <dt>model</dt>
        <dd>{modelLabel(proof.model)}</dd>
        {proof.receiptHash ? (
          <>
            <dt>receipt</dt>
            <dd title={proof.receiptHash}>{shortHash(proof.receiptHash)}</dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}
