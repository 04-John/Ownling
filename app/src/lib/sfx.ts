// Little sounds for touching Mochi and for the quick games, made on the spot with Web Audio: no
// sound files, nothing downloaded. A setting turns them off; a short buzz goes with some of them
// on phones that can vibrate.
const KEY = 'ownling.sound.v1';

export function soundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* private window: the choice lasts for this visit */
  }
}

let ctx: AudioContext | null = null;

/** The one shared audio context, woken up (browsers start it suspended until a tap). */
export function audioContext(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
  return ctx;
}

type Tone = { type?: OscillatorType; from: number; to?: number; at?: number; dur: number; vol?: number };

function tone(a: AudioContext, { type = 'sine', from, to = from, at = 0, dur, vol = 0.16 }: Tone) {
  const t = a.currentTime + at;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

/** A soft rumble: Mochi's version of a purr, like happy far-off thunder. */
function hum(a: AudioContext) {
  const t = a.currentTime;
  const osc = a.createOscillator();
  const wobble = a.createOscillator();
  const depth = a.createGain();
  const gain = a.createGain();
  osc.type = 'triangle';
  osc.frequency.value = 96;
  wobble.frequency.value = 22;
  depth.gain.value = 0.07;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.12, t + 0.12);
  gain.gain.setValueAtTime(0.12, t + 0.6);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
  wobble.connect(depth).connect(gain.gain);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  wobble.start(t);
  osc.stop(t + 1);
  wobble.stop(t + 1);
}

/** A puff of noise, for a cough of soot. */
function puff(a: AudioContext) {
  const t = a.currentTime;
  const buffer = a.createBuffer(1, Math.floor(a.sampleRate * 0.22), a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  const filter = a.createBiquadFilter();
  const gain = a.createGain();
  src.buffer = buffer;
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  gain.gain.value = 0.35;
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(t);
}

export type Sound = 'giggle' | 'boop' | 'hum' | 'dizzy' | 'hmph' | 'plip' | 'sparkle' | 'cough' | 'win' | 'oops';

export function play(sound: Sound): void {
  if (!soundOn()) return;
  const a = audioContext();
  if (!a) return;
  switch (sound) {
    case 'giggle':
      [0, 0.09, 0.18, 0.27].forEach((at, i) => tone(a, { from: 760 + i * 90, to: 1050 + i * 120, at, dur: 0.07, vol: 0.12 }));
      break;
    case 'boop':
      tone(a, { from: 520, to: 340, dur: 0.16, vol: 0.16 });
      break;
    case 'hum':
      hum(a);
      break;
    case 'dizzy':
      tone(a, { type: 'triangle', from: 950, to: 260, dur: 0.75, vol: 0.12 });
      break;
    case 'hmph':
      tone(a, { type: 'sawtooth', from: 190, to: 120, dur: 0.22, vol: 0.06 });
      break;
    case 'plip':
      tone(a, { from: 1100, to: 1700, dur: 0.06, vol: 0.12 });
      break;
    case 'sparkle':
      [0, 0.06, 0.12].forEach((at, i) => tone(a, { from: 1320 + i * 330, dur: 0.09, at, vol: 0.09 }));
      break;
    case 'cough':
      puff(a);
      break;
    case 'win':
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(a, { type: 'triangle', from: f, at: i * 0.1, dur: 0.18, vol: 0.13 }));
      break;
    case 'oops':
      tone(a, { type: 'triangle', from: 392, to: 330, dur: 0.18, vol: 0.13 });
      tone(a, { type: 'triangle', from: 311, to: 262, at: 0.18, dur: 0.3, vol: 0.13 });
      break;
  }
}

/** The four notes of Mochi's tune (C, E, G and high C). */
export const NOTES = [523.25, 659.25, 783.99, 1046.5];

export function playNote(i: number, seconds = 0.35): void {
  if (!soundOn()) return;
  const a = audioContext();
  if (a) tone(a, { type: 'triangle', from: NOTES[i], dur: seconds, vol: 0.18 });
}

/** A short buzz on phones that can vibrate; nothing elsewhere. */
export function buzz(ms = 12): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not allowed here */
  }
}
