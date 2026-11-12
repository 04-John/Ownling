// Catch the rain: move Mochi left and right to catch falling raindrops for 30 seconds. Gold drops
// are worth 3; soot makes Mochi cough and costs 2. Drag anywhere in the sky (or use the arrow
// keys). Free: no food used, no AI; the best score stays on this device.
import { useEffect, useRef, useState } from 'react';
import { usePet } from '../state';
import { renderMochi, MOCHI_COLORS as K } from '../../../design/mochi/mochi';
import { outfitSvg } from '../../../shared/wardrobe';
import { buzz, play } from '../lib/sfx';
import { Mochi } from '../components/Mochi';
import { Button } from '../components/ui';
import { ArcadeBar, Asleep, loadBest, saveBest } from '../components/Arcade';

const ROUND_MS = 30_000;
type Kind = 'drop' | 'gold' | 'soot';
type Thing = { x: number; y: number; vy: number; kind: Kind; wob: number };
type Face = 'none' | 'eating' | 'grumpy';
type Result = { score: number; best: boolean; caught: number; soot: number };

const DROP = new Path2D('M0 -14 C7 -5 10 1 10 6 A10 10 0 0 1 -10 6 C-10 1 -7 -5 0 -14 Z');

function lineFor(r: Result): string {
  if (r.score >= 40) return '*glows like a rainbow* That was a storm of a feast!';
  if (r.score >= 25) return '*pats its tummy* So much rain. You\'re good at this.';
  if (r.score >= 12) return '*licks its lips* Mmm. Again?';
  if (r.soot > r.caught) return '*coughs* Less soot next time, please.';
  return '*giggles* We\'ll catch more next time.';
}

export function RainGame() {
  const pet = usePet();
  const [phase, setPhase] = useState<'ready' | 'playing' | 'over'>('ready');
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(ROUND_MS);
  const [result, setResult] = useState<Result | null>(null);
  const [best, setBest] = useState(() => loadBest('rain', pet));
  const canvas = useRef<HTMLCanvasElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const stopGame = useRef<(() => void) | null>(null);

  useEffect(() => () => stopGame.current?.(), []);

  function start() {
    const cv = canvas.current;
    const box = field.current;
    if (!cv || !box) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    play('plip');
    setPhase('playing');
    setScore(0);
    setLeft(ROUND_MS);
    setResult(null);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = box.clientWidth;
    const H = box.clientHeight;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const size = Math.min(120, W * 0.3);
    const top = H - size + 4;
    const dress = outfitSvg(pet.stage, pet.outfit);
    const faces = {} as Record<Face, HTMLImageElement>;
    for (const face of ['none', 'eating', 'grumpy'] as Face[]) {
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderMochi({ stage: pet.stage, mood: 'content', moment: face, size: 200, name: pet.name, dress }))}`;
      faces[face] = img;
    }

    let x = W / 2;
    let target = W / 2;
    let things: Thing[] = [];
    let points = 0;
    let caught = 0;
    let soot = 0;
    let face: Face = 'none';
    let faceUntil = 0;
    let spawnIn = 400;
    let elapsed = 0;
    let last = performance.now();
    let frame = 0;
    let shownLeft = ROUND_MS;
    const keys = new Set<string>();

    const aim = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      target = Math.max(size / 2, Math.min(W - size / 2, e.clientX - r.left));
    };
    const down = (e: PointerEvent) => {
      cv.setPointerCapture(e.pointerId);
      aim(e);
    };
    const keyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'].includes(e.key)) {
        e.preventDefault();
        keys.add(e.key.toLowerCase());
      }
    };
    const keyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', aim);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);

    const drawThing = (t: Thing) => {
      ctx.save();
      ctx.translate(t.x, t.y);
      if (t.kind === 'soot') {
        ctx.fillStyle = '#4A5060';
        ctx.strokeStyle = K.outline;
        ctx.lineWidth = 2;
        for (const [cx, cy, r] of [[-7, 2, 8], [7, 3, 8], [0, -5, 9]] as const) {
          ctx.beginPath();
          ctx.arc(cx + Math.sin(t.wob) * 1.5, cy, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.fillStyle = '#4A5060';
        ctx.beginPath();
        ctx.arc(0, 1, 8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const k = t.kind === 'gold' ? 1.15 : 0.95;
        ctx.scale(k, k);
        ctx.fillStyle = t.kind === 'gold' ? K.sparkle : K.rain;
        ctx.strokeStyle = K.outline;
        ctx.lineWidth = 2.4;
        ctx.fill(DROP);
        ctx.stroke(DROP);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.ellipse(-3, 3, 2.2, 3.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const finish = () => {
      stop();
      const newBest = saveBest('rain', pet, points);
      if (newBest) setBest(points);
      const r = { score: points, best: newBest, caught, soot };
      setResult(r);
      setPhase('over');
      play(newBest || points >= 12 ? 'win' : 'oops');
    };

    const tick = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      elapsed += dt;
      const progress = Math.min(1, elapsed / ROUND_MS);

      // Move: follow the finger, or the arrow keys.
      if (keys.has('arrowleft') || keys.has('a')) target = Math.max(size / 2, target - 0.5 * dt);
      if (keys.has('arrowright') || keys.has('d')) target = Math.min(W - size / 2, target + 0.5 * dt);
      const step = 0.9 * dt;
      x += Math.max(-step, Math.min(step, target - x));

      // Rain comes faster, and with more soot, as the round goes on.
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawnIn = 620 - 330 * progress + Math.random() * 200;
        const roll = Math.random();
        const kind: Kind = roll < 0.07 ? 'gold' : roll < 0.2 + 0.12 * progress ? 'soot' : 'drop';
        things.push({ x: 14 + Math.random() * (W - 28), y: -16, vy: 0.13 + 0.14 * progress + Math.random() * 0.05, kind, wob: Math.random() * 6 });
      }

      const mouthTop = top + size * 0.32;
      const mouthBottom = top + size * 0.8;
      const reach = size * 0.36;
      things = things.filter((t) => {
        t.y += t.vy * dt;
        t.wob += dt / 200;
        if (t.y > mouthTop && t.y < mouthBottom && Math.abs(t.x - x) < reach) {
          if (t.kind === 'soot') {
            points = Math.max(0, points - 2);
            soot++;
            face = 'grumpy';
            faceUntil = now + 650;
            play('cough');
            buzz(40);
          } else {
            points += t.kind === 'gold' ? 3 : 1;
            caught++;
            face = 'eating';
            faceUntil = now + 220;
            play(t.kind === 'gold' ? 'sparkle' : 'plip');
          }
          setScore(points);
          return false;
        }
        return t.y < H + 20;
      });
      if (now > faceUntil) face = 'none';

      ctx.clearRect(0, 0, W, H);
      things.forEach(drawThing);
      const img = faces[face];
      if (img.complete) ctx.drawImage(img, x - size / 2, top, size, size);

      const remaining = Math.max(0, ROUND_MS - elapsed);
      if (Math.ceil(remaining / 1000) !== Math.ceil(shownLeft / 1000)) setLeft(remaining);
      shownLeft = remaining;
      if (remaining <= 0) return finish();
      frame = requestAnimationFrame(tick);
    };

    function stop() {
      cancelAnimationFrame(frame);
      cv!.removeEventListener('pointerdown', down);
      cv!.removeEventListener('pointermove', aim);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      stopGame.current = null;
    }
    stopGame.current = stop;
    frame = requestAnimationFrame(tick);
  }

  if (pet.hibernating) return <Asleep pet={pet} title="Catch the rain" />;

  return (
    <main className="screen screen--arcade">
      <ArcadeBar title="Catch the rain" />
      <h1 className="sr-only" tabIndex={-1}>
        Catch the rain
      </h1>
      <div className="arcade-stats" aria-hidden={phase !== 'playing'}>
        <span>
          Score <b className="mono">{score}</b>
        </span>
        <span>
          Best <b className="mono">{best}</b>
        </span>
        <span>
          <b className="mono">{Math.ceil(left / 1000)}</b> s
        </span>
      </div>

      <div className="rain-field" ref={field}>
        <canvas
          ref={canvas}
          className="rain-canvas"
          aria-label={`The sky. Drag left and right, or use the arrow keys, to move ${pet.name}.`}
        />
        {phase !== 'playing' ? (
          <div className="arcade-card">
            <Mochi stage={pet.stage} mood={pet.mood} moment={result ? 'eating' : 'playing'} size={110} name={pet.name} outfit={pet.outfit} />
            {result ? (
              <div className="stack-6 center" role="status">
                <p className="arcade-card__title">
                  {result.score} {result.score === 1 ? 'point' : 'points'}
                  {result.best ? ', a new best!' : ''}
                </p>
                <p className="body-text">{lineFor(result)}</p>
              </div>
            ) : (
              <div className="stack-6 center">
                <p className="arcade-card__title">Catch the rain</p>
                <p className="body-text">
                  Drag to move {pet.name} and catch the drops. Gold ones are worth 3. Dodge the soot! You have 30 seconds.
                </p>
              </div>
            )}
            <Button onClick={start}>{result ? 'Play again' : 'Start'}</Button>
            {result ? (
              <a className="text-button" href="#/play">
                Other games
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
