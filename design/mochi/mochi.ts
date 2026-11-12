/**
 * Mochi renderer — Ownling's first cloudling.
 *
 * Pure TypeScript, no dependencies, no DOM. Returns an SVG string, so it works
 * in the game app (any framework), the standalone wake-anywhere client, and on
 * a server (wallet picture). Every look is driven by on-chain state:
 *   stage  <- growth points   (stageFor)
 *   mood   <- food / daily cap (moodFor)
 *   moment <- what just happened in the UI
 *
 * Body and face are separate layers drawn in a 200x200 viewBox. Moods scale the
 * body from the ground point (100,176); moments swap eyes/mouth and add one prop.
 * Include MOCHI_CSS once on the page for the float/bounce/thinking animations.
 */

export type Stage = 'egg' | 'baby' | 'child' | 'teen' | 'adult';
export type Mood = 'content' | 'peckish' | 'hungry' | 'hibernating';
export type Moment =
  | 'none' | 'thinking' | 'talking' | 'eating' | 'playing'
  | 'resting' | 'verified' | 'waking' | 'gifting'
  // Touch reactions: tickled, stroked or hugged, poked too often, poked far too often.
  | 'giggling' | 'loved' | 'dizzy' | 'grumpy';

export interface MochiOptions {
  stage: Stage;
  mood?: Mood;
  moment?: Moment;
  /** Rendered width/height in px. Omit for a fluid 100% SVG. */
  size?: number;
  /** Show the dressing slots (hat, scarf, held item) as dashed guides. */
  slots?: boolean;
  /** Accessible name. Defaults to "Mochi, <stage>, <mood>". */
  title?: string;
  /** Pet name used in the default accessible name. */
  name?: string;
  /** Dressing items as SVG markup on the slot anchors (viewBox units), drawn over Mochi inside
   * its float group so they move with it. Ignored for the egg. See shared/wardrobe.ts. */
  dress?: string;
}

export const STAGES: Stage[] = ['egg', 'baby', 'child', 'teen', 'adult'];
export const MOODS: Mood[] = ['content', 'peckish', 'hungry', 'hibernating'];
export const MOMENTS: Moment[] = ['none', 'thinking', 'talking', 'eating', 'playing', 'resting', 'verified', 'waking', 'gifting', 'giggling', 'loved', 'dizzy', 'grumpy'];

/** Growth points = messages answered + times played (handbook). */
export function stageFor(growthPoints: number): Stage {
  if (growthPoints <= 0) return 'egg';
  if (growthPoints < 20) return 'baby';
  if (growthPoints < 75) return 'child';
  if (growthPoints < 200) return 'teen';
  return 'adult';
}

/** Days of thinking left at the daily cap. Returns null when unknown (show "—"). */
export function runwayDays(foodNear: number | null | undefined, dailyCapNear = 0.02): number | null {
  if (foodNear == null || !Number.isFinite(foodNear) || dailyCapNear <= 0) return null;
  return foodNear / dailyCapNear;
}

/** Hunger mood from food budget vs daily cap (default cap 0.02 NEAR/day). */
export function moodFor(foodNear: number, dailyCapNear = 0.02): Mood {
  if (foodNear < 0.0001) return 'hibernating';
  const days = foodNear / dailyCapNear;
  if (days < 2) return 'hungry';
  if (days < 7) return 'peckish';
  return 'content';
}

export const MOCHI_CSS = `
@keyframes ownlingMochiFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes ownlingMochiBounce{0%,100%{transform:translateY(0)}30%{transform:translateY(-16px)}60%{transform:translateY(0)}}
@keyframes ownlingMochiDot{0%,100%{opacity:.3}50%{opacity:1}}
.mochi-float{animation:ownlingMochiFloat 3.6s ease-in-out infinite}
.mochi-bounce{animation:ownlingMochiBounce 1.1s ease-in-out infinite}
.mochi-dot1{animation:ownlingMochiDot 1.2s ease-in-out infinite}
.mochi-dot2{animation:ownlingMochiDot 1.2s ease-in-out .2s infinite}
.mochi-dot3{animation:ownlingMochiDot 1.2s ease-in-out .4s infinite}
@keyframes ownlingMochiWiggle{0%,100%{transform:rotate(0)}20%{transform:rotate(-7deg)}40%{transform:rotate(6deg)}60%{transform:rotate(-4deg)}80%{transform:rotate(3deg)}}
@keyframes ownlingMochiSway{0%,100%{transform:rotate(0)}25%{transform:translateX(-4px) rotate(-5deg)}75%{transform:translateX(4px) rotate(5deg)}}
@keyframes ownlingMochiShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
@keyframes ownlingMochiRise{0%{transform:translateY(8px);opacity:0}15%{opacity:1}75%{opacity:1}100%{transform:translateY(-20px);opacity:0}}
.mochi-wiggle{animation:ownlingMochiWiggle .6s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}
.mochi-sway{animation:ownlingMochiSway 1.2s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}
.mochi-shake{animation:ownlingMochiShake .25s linear infinite}
.mochi-rise1{animation:ownlingMochiRise 1.6s ease-out infinite both}
.mochi-rise2{animation:ownlingMochiRise 1.6s ease-out .5s infinite both}
.mochi-rise3{animation:ownlingMochiRise 1.6s ease-out 1s infinite both}
@media (prefers-reduced-motion: reduce){.mochi-float,.mochi-bounce,.mochi-dot1,.mochi-dot2,.mochi-dot3,.mochi-wiggle,.mochi-sway,.mochi-shake,.mochi-rise1,.mochi-rise2,.mochi-rise3{animation:none}}
`;

/** Named swatches used inside the art (same in light and dark themes). */
export const MOCHI_COLORS = {
  outline: '#2B3145',
  outlineSleep: '#7E8597',
  inkSleep: '#5D6475',
  bodyLight: '#FFFFFF',
  bodyShade: '#D3DEF6',
  paleLight: '#F4F5F8',
  paleShade: '#CBD2E0',
  sleepLight: '#E2E5EB',
  sleepShade: '#B3B9C6',
  eggShade: '#CFDDF8',
  wisp: '#8DB4F2',
  blush: '#F4A3AE',
  tongue: '#E8737F',
  rain: '#6AA6F2',
  sparkle: '#F2B33D',
  proof: '#1A6B48',
  slot: '#2D63D8',
} as const;

interface Circle { x: number; y: number; r: number }
interface StageGeo { c: Circle[]; top: number; left: number; right: number; fx: number; fy: number; fs: number; sh: number }

const C = (x: number, y: number, r: number): Circle => ({ x, y, r });

/** Body geometry per stage (viewBox 0 0 200 200). Face anchor = fx,fy at scale fs. */
export const STAGE_GEOMETRY: Record<Stage, StageGeo> = {
  egg: { c: [], top: 66, left: 58, right: 142, fx: 100, fy: 128, fs: 0.9, sh: 36 },
  baby: { c: [C(100, 132, 36), C(82, 112, 20), C(116, 106, 22)], top: 84, left: 64, right: 136, fx: 100, fy: 136, fs: 0.78, sh: 36 },
  child: { c: [C(100, 124, 46), C(66, 134, 28), C(134, 134, 28), C(82, 94, 28), C(118, 88, 30)], top: 58, left: 38, right: 162, fx: 100, fy: 128, fs: 1, sh: 54 },
  teen: { c: [C(100, 120, 50), C(60, 132, 32), C(140, 132, 32), C(76, 90, 30), C(112, 76, 34), C(146, 100, 22)], top: 42, left: 28, right: 172, fx: 100, fy: 124, fs: 1.05, sh: 62 },
  adult: { c: [C(100, 122, 52), C(54, 134, 32), C(146, 134, 32), C(66, 94, 32), C(104, 70, 38), C(140, 90, 32), C(100, 148, 28)], top: 32, left: 22, right: 178, fx: 100, fy: 120, fs: 1.12, sh: 72 },
};

type Eyes = 'open' | 'side' | 'up' | 'wide' | 'happy' | 'sleepy' | 'asleep' | 'squeeze' | 'dizzy' | 'grumpy';
type Mouth = 'smile' | 'open' | 'o' | 'wobble' | 'big' | 'frown' | 'none';

const MOMENT_FACE: Partial<Record<Moment, [Eyes, Mouth]>> = {
  thinking: ['up', 'o'],
  talking: ['open', 'open'],
  eating: ['happy', 'big'],
  playing: ['happy', 'open'],
  resting: ['sleepy', 'smile'],
  verified: ['open', 'smile'],
  waking: ['wide', 'o'],
  gifting: ['happy', 'smile'],
  giggling: ['squeeze', 'big'],
  loved: ['happy', 'smile'],
  dizzy: ['dizzy', 'wobble'],
  grumpy: ['grumpy', 'frown'],
};

const DROP = 'M0 -14 C7 -5 10 1 10 6 A10 10 0 0 1 -10 6 C-10 1 -7 -5 0 -14 Z';
const STAR = 'M0 -9 L2.2 -2.2 L9 0 L2.2 2.2 L0 9 L-2.2 2.2 L-9 0 L-2.2 -2.2 Z';
const HEART = 'M0 6 C-10 -2 -9 -11 -3.5 -11 C-1.5 -11 0 -9.5 0 -8 C0 -9.5 1.5 -11 3.5 -11 C9 -11 10 -2 0 6 Z';
const r2 = (n: number) => Math.round(n * 100) / 100;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/** Which face a given state shows. Exported so apps can reuse the logic (e.g. for layered PNGs). */
export function faceFor(mood: Mood, moment: Moment): { eyes: Eyes; mouth: Mouth } {
  let eyes: Eyes = 'open';
  let mouth: Mouth = 'smile';
  if (mood === 'peckish') { eyes = 'side'; mouth = 'o'; }
  if (mood === 'hungry') { eyes = 'sleepy'; mouth = 'wobble'; }
  if (mood === 'hibernating') return { eyes: 'asleep', mouth: 'none' };
  const m = MOMENT_FACE[moment];
  if (m) { eyes = m[0]; mouth = m[1]; }
  return { eyes, mouth };
}

/** Render Mochi as an SVG string. */
export function renderMochi(opts: MochiOptions): string {
  const stage = opts.stage;
  const mood: Mood = opts.mood ?? 'content';
  const moment: Moment = opts.moment ?? 'none';
  const s = STAGE_GEOMETRY[stage];
  const hib = mood === 'hibernating';
  const egg = stage === 'egg';
  const K = MOCHI_COLORS;

  const { eyes, mouth } = faceFor(mood, moment);
  let sx = 1, sy = 1;
  if (mood === 'hungry') { sx = 0.9; sy = 0.84; }
  if (hib) { sx = 0.94; sy = 0.88; }

  let motion = 'mochi-float';
  if (hib || mood === 'hungry' || moment === 'eating' || moment === 'resting') motion = '';
  if (moment === 'playing' && !hib && !egg) motion = 'mochi-bounce';
  if (!hib && moment === 'giggling') motion = 'mochi-wiggle';
  if (!hib && moment === 'dizzy') motion = 'mochi-sway';
  if (!hib && moment === 'grumpy') motion = 'mochi-shake';

  const outline = hib ? K.outlineSleep : K.outline;
  const ink = hib ? K.inkSleep : K.outline;
  const bodyFill = hib ? 'url(#ownling-mochi-sleep)' : mood === 'hungry' ? 'url(#ownling-mochi-pale)' : 'url(#ownling-mochi-live)';
  const label = opts.title ?? `${opts.name ?? 'Mochi'}, ${stage}, ${mood}${moment !== 'none' ? ', ' + moment : ''}`;
  const sizeAttr = opts.size ? `width="${opts.size}" height="${opts.size}"` : 'width="100%" height="100%"';
  const fs = s.fs;
  const out: string[] = [];

  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" ${sizeAttr} style="overflow:visible;display:block" role="img" aria-label="${esc(label)}" data-stage="${stage}" data-mood="${mood}" data-moment="${moment}">`);
  out.push(`<defs>
<radialGradient id="ownling-mochi-live" gradientUnits="userSpaceOnUse" cx="86" cy="74" r="132"><stop offset="0.42" stop-color="${K.bodyLight}"/><stop offset="1" stop-color="${K.bodyShade}"/></radialGradient>
<radialGradient id="ownling-mochi-pale" gradientUnits="userSpaceOnUse" cx="86" cy="74" r="132"><stop offset="0.42" stop-color="${K.paleLight}"/><stop offset="1" stop-color="${K.paleShade}"/></radialGradient>
<radialGradient id="ownling-mochi-sleep" gradientUnits="userSpaceOnUse" cx="86" cy="74" r="132"><stop offset="0.3" stop-color="${K.sleepLight}"/><stop offset="1" stop-color="${K.sleepShade}"/></radialGradient>
<radialGradient id="ownling-mochi-egg" gradientUnits="userSpaceOnUse" cx="88" cy="96" r="90"><stop offset="0.3" stop-color="#FFFFFF"/><stop offset="1" stop-color="${K.eggShade}"/></radialGradient>
</defs>`);
  // layer: mochi/shadow
  out.push(`<ellipse data-layer="mochi/shadow" cx="100" cy="182" rx="${r2(s.sh * sx)}" ry="7" fill="${K.outline}" opacity="0.12"/>`);
  out.push(`<g class="${motion}"><g transform="translate(100 176) scale(${sx} ${sy}) translate(-100 -176)">`);

  // layer: mochi/<stage>/body
  if (egg) {
    out.push(`<g data-layer="mochi/egg/body">
<path d="M100 66 C128 66 142 110 142 132 C142 158 123 172 100 172 C77 172 58 158 58 132 C58 110 72 66 100 66 Z" fill="${hib ? 'url(#ownling-mochi-sleep)' : 'url(#ownling-mochi-egg)'}" stroke="${outline}" stroke-width="4"/>
<path d="M62 124 C72 114 82 130 92 120 C102 110 112 128 122 118 C130 110 136 118 139 122" fill="none" stroke="${hib ? '#9AA1B0' : K.wisp}" stroke-width="4" stroke-linecap="round"/>
${!hib && (moment === 'talking' || moment === 'waking') ? `<path data-layer="mochi/prop/crack" d="M106 82 L101 92 L108 98 L103 106" fill="none" stroke="${outline}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
<ellipse cx="84" cy="92" rx="7" ry="11" fill="#FFFFFF" opacity="0.8" transform="rotate(20 84 92)"/>
</g>`);
  } else {
    // Outline trick: draw every puff with a thick stroke, then the fills on top -> one merged outline.
    const outlineLayer = s.c.map((c) => `<circle cx="${c.x}" cy="${c.y}" r="${c.r}" fill="${outline}" stroke="${outline}" stroke-width="8"/>`).join('');
    const fillLayer = s.c.map((c) => `<circle cx="${c.x}" cy="${c.y}" r="${c.r}" fill="${bodyFill}"/>`).join('');
    let extra = '';
    if (stage === 'teen') extra += `<path d="M112 42 C109 30 122 24 129 31 C134 36 128 43 122 39" fill="none" stroke="${outline}" stroke-width="4" stroke-linecap="round"/>`;
    if (stage === 'adult') extra += `<path d="M88 34 C92 26 100 24 104 30" fill="none" stroke="${outline}" stroke-width="3.4" stroke-linecap="round"/><path d="M110 28 C114 22 122 22 124 28" fill="none" stroke="${outline}" stroke-width="3.4" stroke-linecap="round"/>`;
    out.push(`<g data-layer="mochi/${stage}/body">${outlineLayer}${fillLayer}${extra}</g>`);

    // layer: mochi/face/*
    const f: string[] = [];
    if (!hib && mood !== 'hungry') f.push(`<g data-layer="mochi/face/cheeks"><ellipse cx="-27" cy="7" rx="7.5" ry="4.2" fill="${K.blush}" opacity="0.9"/><ellipse cx="27" cy="7" rx="7.5" ry="4.2" fill="${K.blush}" opacity="0.9"/></g>`);
    if (eyes === 'open' || eyes === 'side' || eyes === 'up' || eyes === 'wide') {
      const px = eyes === 'side' ? 3.2 : eyes === 'up' ? 2 : 0;
      const py = eyes === 'up' ? -3 : 0;
      const rx = eyes === 'wide' ? 6.6 : 5.6;
      const ry = eyes === 'wide' ? 8.6 : 7.2;
      f.push(`<g data-layer="mochi/face/eyes-${eyes === 'wide' ? 'wide' : 'open'}"><ellipse cx="${-16 + px}" cy="${-4 + py}" rx="${rx}" ry="${ry}" fill="${ink}"/><ellipse cx="${16 + px}" cy="${-4 + py}" rx="${rx}" ry="${ry}" fill="${ink}"/><circle cx="${-14 + px}" cy="${-7 + py}" r="2.1" fill="#FFFFFF"/><circle cx="${18 + px}" cy="${-7 + py}" r="2.1" fill="#FFFFFF"/></g>`);
    }
    if (eyes === 'happy') f.push(`<path data-layer="mochi/face/eyes-happy" d="M-23 -2 Q-16 -11 -9 -2 M9 -2 Q16 -11 23 -2" fill="none" stroke="${ink}" stroke-width="3.4" stroke-linecap="round"/>`);
    if (eyes === 'sleepy') f.push(`<g data-layer="mochi/face/eyes-sleepy"><path d="M-23 -3 A7 6 0 0 0 -9 -3 Z" fill="${ink}"/><path d="M9 -3 A7 6 0 0 0 23 -3 Z" fill="${ink}"/><path d="M-25 -3 L-7 -3 M7 -3 L25 -3" stroke="${ink}" stroke-width="3" stroke-linecap="round"/></g>`);
    if (eyes === 'squeeze') f.push(`<path data-layer="mochi/face/eyes-squeeze" d="M-22 -10 L-11 -4 L-22 2 M22 -10 L11 -4 L22 2" fill="none" stroke="${ink}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`);
    if (eyes === 'dizzy') {
      const spiral = (cx: number) => `M${cx} -4 a1.5 1.5 0 0 1 3 0 a3 3 0 0 1 -6 0 a4.5 4.5 0 0 1 9 0 a6 6 0 0 1 -12 0`;
      f.push(`<path data-layer="mochi/face/eyes-dizzy" d="${spiral(-17)} ${spiral(15)}" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`);
    }
    if (eyes === 'grumpy') f.push(`<g data-layer="mochi/face/eyes-grumpy"><ellipse cx="-16" cy="-3" rx="5" ry="5.6" fill="${ink}"/><ellipse cx="16" cy="-3" rx="5" ry="5.6" fill="${ink}"/><path d="M-25 -15 L-9 -10 M25 -15 L9 -10" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/></g>`);
    if (eyes === 'asleep') f.push(`<path data-layer="mochi/face/eyes-asleep" d="M-23 -4 Q-16 3 -9 -4 M9 -4 Q16 3 23 -4" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`);
    if (mouth === 'smile') f.push(`<path data-layer="mochi/face/mouth-smile" d="M-6 9 Q0 15 6 9" fill="none" stroke="${ink}" stroke-width="2.8" stroke-linecap="round"/>`);
    if (mouth === 'open') f.push(`<g data-layer="mochi/face/mouth-open"><ellipse cx="0" cy="11" rx="5" ry="4.6" fill="${ink}"/><ellipse cx="0" cy="13.2" rx="3" ry="1.8" fill="${K.tongue}"/></g>`);
    if (mouth === 'o') f.push(`<circle data-layer="mochi/face/mouth-o" cx="0" cy="11" r="2.7" fill="${ink}"/>`);
    if (mouth === 'wobble') f.push(`<path data-layer="mochi/face/mouth-wobble" d="M-7 12 Q-3.5 8.5 0 12 Q3.5 15.5 7 12" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>`);
    if (mouth === 'frown') f.push(`<path data-layer="mochi/face/mouth-frown" d="M-6 14 Q0 8 6 14" fill="none" stroke="${ink}" stroke-width="2.8" stroke-linecap="round"/>`);
    if (mouth === 'big') f.push(`<g data-layer="mochi/face/mouth-big"><ellipse cx="0" cy="12" rx="7" ry="6.6" fill="${ink}"/><ellipse cx="0" cy="15.4" rx="4.2" ry="2.4" fill="${K.tongue}"/></g>`);
    out.push(`<g data-layer="mochi/face" transform="translate(${s.fx} ${s.fy}) scale(${fs})">${f.join('')}</g>`);
  }

  // layer: mochi/outfit (dressing items on the slot anchors)
  if (opts.dress && !egg) out.push(`<g data-layer="mochi/outfit">${opts.dress}</g>`);

  // layer: mochi/prop/*
  if (!hib && !egg && moment === 'thinking') {
    out.push(`<g data-layer="mochi/prop/think" transform="translate(${Math.min(s.right - 6, 158)} ${s.top - 10})"><circle cx="-12" cy="20" r="3.5" fill="#FFFFFF" stroke="${K.outline}" stroke-width="2.4"/><ellipse cx="12" cy="-4" rx="24" ry="15" fill="#FFFFFF" stroke="${K.outline}" stroke-width="3"/><circle class="mochi-dot1" cx="2" cy="-4" r="3.2" fill="${K.outline}"/><circle class="mochi-dot2" cx="12" cy="-4" r="3.2" fill="${K.outline}"/><circle class="mochi-dot3" cx="22" cy="-4" r="3.2" fill="${K.outline}"/></g>`);
  }
  if (hib) {
    out.push(`<g data-layer="mochi/prop/zz" transform="translate(${Math.min(s.right - 18, 150)} ${s.top - 2})"><path d="M0 0 H11 L0 13 H11" fill="none" stroke="${K.outlineSleep}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 -18 H24 L16 -8 H24" fill="none" stroke="${K.outlineSleep}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></g>`);
  }
  const drop = (x: number, y: number, k: number, layer: string) =>
    `<g data-layer="${layer}" transform="translate(${r2(x)} ${r2(y)}) scale(${k})"><path d="${DROP}" fill="${K.rain}" stroke="${K.outline}" stroke-width="2.6"/><ellipse cx="-3" cy="3" rx="2.2" ry="3.4" fill="#FFFFFF" opacity="0.85"/></g>`;
  if (!hib && !egg && moment === 'eating') out.push(drop(s.fx + 13 * fs, s.fy + 4 * fs, 0.8, 'mochi/prop/raindrop'));
  if (!hib && !egg && mood === 'peckish' && moment === 'none') out.push(drop(Math.min(s.right + 16, 190), s.fy + 14, 0.7, 'mochi/prop/raindrop-hint'));
  if (!hib && (moment === 'playing' || moment === 'waking')) {
    const star = (x: number, y: number, k: number) => `<path transform="translate(${r2(x)} ${r2(y)}) scale(${k})" d="${STAR}" fill="${K.sparkle}" stroke="${K.outline}" stroke-width="${r2(1.8 / k)}" stroke-linejoin="round"/>`;
    out.push(`<g data-layer="mochi/prop/sparkle">${star(s.left + 2, s.top + 14, 1)}${star(s.right - 4, s.top + 2, 0.7)}${star(Math.min(s.right + 8, 188), s.fy + 22, 0.55)}</g>`);
  }
  if (!hib && !egg && moment === 'resting') {
    out.push(`<g data-layer="mochi/prop/sweat" transform="translate(${r2(s.fx + 30 * fs)} ${r2(s.fy - 26 * fs)}) scale(0.55)"><path d="${DROP}" fill="#CFE2FB" stroke="${K.outline}" stroke-width="3"/></g>`);
  }
  if (moment === 'verified') {
    out.push(`<g data-layer="mochi/prop/proof" transform="translate(${s.right - 10} ${s.top + 22})"><circle r="13" fill="${K.proof}" stroke="#FFFFFF" stroke-width="3"/><path d="M-6 0 L-1.5 4.5 L6.5 -4" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>`);
  }
  if (!egg && moment === 'gifting') {
    out.push(`<g data-layer="mochi/prop/bow" transform="translate(${s.fx + 20} ${s.top + 6})"><path d="M0 0 C-6 -12 -22 -12 -20 -2 C-19 6 -8 6 0 0 Z" fill="${K.blush}" stroke="${K.outline}" stroke-width="2.6" stroke-linejoin="round"/><path d="M0 0 C6 -12 22 -12 20 -2 C19 6 8 6 0 0 Z" fill="${K.blush}" stroke="${K.outline}" stroke-width="2.6" stroke-linejoin="round"/><circle r="4.5" fill="${K.tongue}" stroke="${K.outline}" stroke-width="2.4"/></g>`);
  }
  if (!hib && moment === 'loved') {
    const heart = (x: number, y: number, k: number, n: number) => `<g transform="translate(${r2(x)} ${r2(y)}) scale(${k})"><path class="mochi-rise${n}" d="${HEART}" fill="${K.tongue}" stroke="${K.outline}" stroke-width="${r2(2.2 / k)}" stroke-linejoin="round"/></g>`;
    out.push(`<g data-layer="mochi/prop/hearts">${heart(s.fx - 36, s.top - 12, 1.35, 1)}${heart(s.fx + 32, s.top - 18, 1.1, 2)}${heart(s.fx - 2, s.top - 30, 0.9, 3)}</g>`);
  }
  if (!hib && moment === 'dizzy') {
    const star = (x: number, y: number, k: number, n: number) => `<path class="mochi-dot${n}" transform="translate(${r2(x)} ${r2(y)}) scale(${k})" d="${STAR}" fill="${K.sparkle}" stroke="${K.outline}" stroke-width="${r2(1.8 / k)}" stroke-linejoin="round"/>`;
    out.push(`<g data-layer="mochi/prop/dizzy-stars">${star(s.fx - 34, s.top + 4, 0.7, 1)}${star(s.fx + 2, s.top - 12, 0.8, 2)}${star(s.fx + 36, s.top + 2, 0.65, 3)}</g>`);
  }
  if (!hib && moment === 'grumpy') {
    const x = Math.min(s.right - 10, 160);
    const y = s.top - 8;
    out.push(`<g data-layer="mochi/prop/storm" transform="translate(${x} ${y})"><path d="M-3 8 L-8 18 L-2 18 L-6 28" fill="none" stroke="${K.sparkle}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="-10" cy="2" r="8" fill="${K.inkSleep}" stroke="${K.outline}" stroke-width="2.4"/><circle cx="6" cy="2" r="9" fill="${K.inkSleep}" stroke="${K.outline}" stroke-width="2.4"/><circle cx="-2" cy="-5" r="9" fill="${K.inkSleep}" stroke="${K.outline}" stroke-width="2.4"/><circle cx="-10" cy="2" r="6.8" fill="${K.inkSleep}"/><circle cx="6" cy="2" r="7.8" fill="${K.inkSleep}"/></g>`);
  }
  if (opts.slots && !egg) {
    const t = (x: number, y: number, txt: string, anchor = 'middle') => `<text x="${r2(x)}" y="${r2(y)}" text-anchor="${anchor}" font-size="10" font-weight="700" fill="${K.slot}" font-family="JetBrains Mono, monospace">${txt}</text>`;
    const dash = `fill="none" stroke="${K.slot}" stroke-width="2" stroke-dasharray="5 4"`;
    out.push(`<g data-layer="mochi/slot">
<ellipse data-slot="hat" cx="${s.fx + 4}" cy="${s.top - 4}" rx="24" ry="13" ${dash}/>${t(s.fx + 4, s.top - 22, 'hat')}
<rect data-slot="scarf" x="${s.fx - 36}" y="${r2(s.fy + 26 * fs)}" width="72" height="14" rx="7" ${dash}/>${t(s.fx + 40, s.fy + 26 * fs + 11, 'scarf', 'start')}
<circle data-slot="item" cx="${s.left + 4}" cy="${s.fy + 30}" r="13" ${dash}/>${t(s.left + 4, s.fy + 56, 'item')}
</g>`);
  }

  out.push('</g></g></svg>');
  return out.join('\n');
}

/**
 * Slot anchors per stage in viewBox units, for positioning dressing items
 * (hat, scarf, held item). Draw items centred on these points.
 */
export function slotAnchors(stage: Stage): { hat: [number, number]; scarf: [number, number]; item: [number, number] } {
  const s = STAGE_GEOMETRY[stage];
  return {
    hat: [s.fx + 4, s.top - 4],
    scarf: [s.fx, r2(s.fy + 26 * s.fs + 7)],
    item: [s.left + 4, s.fy + 30],
  };
}
