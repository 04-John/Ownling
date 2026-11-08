// Formatting helpers shared by every screen. Copy rules: sentence case, "—" for unknown values
// (never 0), NEAR amounts always rendered in mono by the caller.
import type { Mood, Stage } from './types';

export const DASH = '—';

/** NEAR amount without unit: 0.1, 0.02, 0.49, 0.000024. "—" when unknown. */
export function fmtNear(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return DASH;
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs < 0.000001) return n > 0 ? '< 0.000001' : '> -0.000001';
  const s = abs >= 0.01 ? n.toFixed(2) : n.toFixed(6);
  return s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

/** Whole days, rounded down, with a little slack for float error (0.56 / 0.02 = 27.999…). */
export function wholeDays(days: number | null | undefined): number | null {
  if (days == null || !Number.isFinite(days)) return null;
  return Math.max(0, Math.floor(days + 1e-9));
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "can think for 23 more days" (lower-case start, so callers can prefix a name). */
export function runwayPhrase(days: number | null): string {
  const n = wholeDays(days);
  if (n == null) return `can think for ${DASH} more days`;
  if (n < 1) return days != null && days > 0 ? 'can think for less than a day' : "can't afford a thought";
  return n === 1 ? 'can think for 1 more day' : `can think for ${n} more days`;
}

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** "At least 28 days" after adding `amount` to `food` at the full daily cap. */
export function atLeastDays(food: number, amount: number, cap: number): string {
  if (!Number.isFinite(food) || !(cap > 0)) return DASH;
  const n = wholeDays((food + amount) / cap) ?? 0;
  return `At least ${plural(n, 'day', 'days')}`;
}

/** "+5 days" for a feed portion. */
export function portionDays(amount: number, cap: number): string {
  if (!(cap > 0)) return DASH;
  const n = wholeDays(amount / cap) ?? 0;
  return `+${plural(n, 'day', 'days')}`;
}

const MOOD_LABEL: Record<Mood, string> = {
  content: 'Content',
  peckish: 'Peckish',
  hungry: 'Very hungry',
  hibernating: 'Hibernating',
};
export const moodLabel = (m: Mood) => MOOD_LABEL[m];
export const stageLabel = (s: Stage) => capitalize(s);

/** The next growth stage and the points it needs, or null when fully grown. */
export function nextStage(growth: number): { stage: Stage; at: number } | null {
  if (growth < 1) return { stage: 'baby', at: 1 };
  if (growth < 20) return { stage: 'child', at: 20 };
  if (growth < 75) return { stage: 'teen', at: 75 };
  if (growth < 200) return { stage: 'adult', at: 200 };
  return null;
}

/** "Growth 34 · teen at 75" */
export function growthLine(growth: number): string {
  const next = nextStage(growth);
  return next ? `Growth ${growth} · ${next.stage} at ${next.at}` : `Growth ${growth} · fully grown`;
}

const MODEL_NAMES: Record<string, string> = {
  'z-ai/glm-5.3-flash': 'GLM-5.3 Flash · NEAR AI',
  practice: 'Practice kitchen',
};
export function modelLabel(model: string | null | undefined): string {
  if (!model) return DASH;
  return MODEL_NAMES[model] ?? model;
}

/** 3f9a…c21e */
export function shortHash(h: string): string {
  return h.length > 12 ? `${h.slice(0, 4)}…${h.slice(-4)}` : h;
}

export function fmtBytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return DASH;
  if (n < 1000) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function shortDate(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** "Today", "Yesterday" or "Nov 7" for a chat timestamp. */
export function dayLabel(at: number, now = Date.now()): string {
  const d = new Date(at);
  if (!at || Number.isNaN(d.getTime())) return DASH;
  const today = new Date(now);
  const yesterday = new Date(now - 86_400_000);
  if (dayKey(d) === dayKey(today)) return 'Today';
  if (dayKey(d) === dayKey(yesterday)) return 'Yesterday';
  return shortDate(d);
}
export const sameDay = (a: number, b: number) => dayKey(new Date(a)) === dayKey(new Date(b));

/** "9:58" */
export function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** NEAR account id rules: 2–64 chars, lower-case parts joined by dots, - and _ inside parts. */
export function isAccountId(s: string): boolean {
  return s.length >= 2 && s.length <= 64 && /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(s);
}

/** A thrown value as text that is safe to show. */
export function errorText(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === 'string' && e) return e;
  return 'Something went wrong. Try again.';
}
