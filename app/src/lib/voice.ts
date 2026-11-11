// Voice: a short clip for Talk's microphone button, and hands-free listening for voice chat, both
// recorded with the browser's MediaRecorder. Works in browsers, the Android app (RECORD_AUDIO in
// its manifest) and the Windows app. Clips go to the kitchen, which turns them into text on NEAR
// AI; nothing is kept.
import { useEffect, useRef, useState } from 'react';

export const MAX_CLIP_MS = 30_000;
const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

/**
 * Recorders give WebM/Opus (Chromium, Android) or MP4/AAC (Safari), and NEAR AI's Whisper refuses
 * some of those. Every clip goes out as 16 kHz mono WAV, Whisper's own format, decoded and
 * resampled here in the browser.
 */
export async function toWav(clip: Blob): Promise<Blob> {
  const rate = 16_000;
  const decoded = await new OfflineAudioContext(1, 1, rate).decodeAudioData(await clip.arrayBuffer());
  const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const pcm = (await offline.startRendering()).getChannelData(0);
  const view = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const ascii = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length * 2, true);
  ascii(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, pcm.length * 2, true);
  pcm.forEach((s, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true));
  return new Blob([view.buffer], { type: 'audio/wav' });
}

/** Speech louder than this (RMS of the signal, 0 to 1) counts as talking. */
const SPEECH_LEVEL = 0.02;
/** A partial clip for the live transcript, this often while you speak. */
const PARTIAL_EVERY_MS = 2500;
/** With nobody talking, recording starts over this often, so clips stay small. */
const IDLE_RESET_MS = 10_000;

export type Listener = {
  /** Stop listening while Mochi thinks and talks, so it never hears itself. */
  pause(): void;
  resume(): void;
  stop(): void;
};

/**
 * Hands-free listening for voice chat: watches the microphone level, sends a partial clip every
 * few seconds while you talk (for the live transcript), and the whole utterance once you've been
 * quiet for `silenceMs()`. Then it waits, paused, until resume().
 */
export async function startListening(opts: {
  /** Read on every check, so changing it takes effect mid-chat. */
  silenceMs: () => number;
  onLevel?: (level: number) => void;
  onPartial?: (clip: Blob) => void;
  onUtterance: (clip: Blob) => void;
}): Promise<Listener> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const audio = new AudioContext();
  await audio.resume();
  const analyser = audio.createAnalyser();
  analyser.fftSize = 1024;
  audio.createMediaStreamSource(stream).connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t));

  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let startedAt = 0;
  let speechAt = 0;
  let lastVoiceAt = 0;
  let partialAt = 0;
  let paused = false;
  let stopped = false;
  const clip = () => new Blob(chunks, { type: recorder?.mimeType || mimeType || 'audio/webm' });

  function record() {
    chunks = [];
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.start(250);
    startedAt = performance.now();
    speechAt = 0;
    partialAt = 0;
  }

  function finish() {
    const r = recorder;
    recorder = null;
    paused = true;
    if (!r || r.state !== 'recording') return;
    r.onstop = () => opts.onUtterance(new Blob(chunks, { type: r.mimeType || mimeType || 'audio/webm' }));
    r.stop();
  }

  const timer = window.setInterval(() => {
    if (paused || stopped || !recorder) return;
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const s of samples) sum += s * s;
    const level = Math.sqrt(sum / samples.length);
    opts.onLevel?.(level);
    const now = performance.now();
    if (level > SPEECH_LEVEL) {
      if (!speechAt) speechAt = now;
      lastVoiceAt = now;
    }
    if (!speechAt) {
      if (now - startedAt > IDLE_RESET_MS) {
        recorder.onstop = null;
        recorder.stop();
        record();
      }
      return;
    }
    if (now - lastVoiceAt > opts.silenceMs() || now - speechAt > MAX_CLIP_MS) return finish();
    if (opts.onPartial && now - speechAt > 1200 && now - partialAt > PARTIAL_EVERY_MS) {
      partialAt = now;
      opts.onPartial(clip());
    }
  }, 100);

  record();
  return {
    pause() {
      paused = true;
      if (recorder?.state === 'recording') {
        recorder.onstop = null;
        recorder.stop();
      }
      recorder = null;
    },
    resume() {
      if (stopped) return;
      paused = false;
      record();
    },
    stop() {
      stopped = true;
      window.clearInterval(timer);
      if (recorder?.state === 'recording') {
        recorder.onstop = null;
        recorder.stop();
      }
      stream.getTracks().forEach((t) => t.stop());
      audio.close().catch(() => undefined);
    },
  };
}

export const canRecord = (): boolean =>
  typeof MediaRecorder !== 'undefined' && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

/** Start and stop a recording; `onClip` gets the clip when it stops (by tap or after 30 s). */
export function useRecorder(onClip: (clip: Blob) => void) {
  const [since, setSince] = useState<number | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const discard = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const callback = useRef(onClip);
  callback.current = onClip;

  // Leaving the screen mid-recording drops the clip and frees the microphone.
  useEffect(
    () => () => {
      discard.current = true;
      if (recorder.current?.state === 'recording') recorder.current.stop();
    },
    [],
  );

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    r.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      window.clearTimeout(timer.current);
      recorder.current = null;
      setSince(null);
      if (!discard.current) callback.current(new Blob(chunks, { type: r.mimeType || mimeType || 'audio/webm' }));
    };
    discard.current = false;
    r.start();
    recorder.current = r;
    setSince(Date.now());
    timer.current = window.setTimeout(() => r.state === 'recording' && r.stop(), MAX_CLIP_MS);
  }

  function stop() {
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }

  return { recording: since != null, since, start, stop };
}
