// Echo: Mochi says back whatever you said, in a voice of its own. The clip is played back right
// here with Web Audio (faster for a squeaky cloud, slower for thunder, with a canyon echo) and then
// thrown away: it never leaves the device.
import { audioContext } from './sfx';

export type EchoVoice = 'squeaky' | 'thunder' | 'canyon';

export const ECHO_VOICES: Record<EchoVoice, { label: string; rate: number; echo: boolean }> = {
  squeaky: { label: 'Squeaky', rate: 1.6, echo: false },
  thunder: { label: 'Thunder', rate: 0.72, echo: false },
  canyon: { label: 'Canyon', rate: 1.3, echo: true },
};

/** Cut the quiet before and after the words, so Mochi answers straight away. */
function trim(a: AudioContext, buffer: AudioBuffer): AudioBuffer {
  const data = buffer.getChannelData(0);
  const loud = 0.02;
  let start = 0;
  let end = data.length - 1;
  while (start < end && Math.abs(data[start]) < loud) start++;
  while (end > start && Math.abs(data[end]) < loud) end--;
  const pad = Math.floor(buffer.sampleRate * 0.06);
  start = Math.max(0, start - pad);
  end = Math.min(data.length, end + pad);
  if (end - start < buffer.sampleRate * 0.15) return buffer;
  const out = a.createBuffer(buffer.numberOfChannels, end - start, buffer.sampleRate);
  for (let c = 0; c < buffer.numberOfChannels; c++) out.copyToChannel(buffer.getChannelData(c).subarray(start, end), c);
  return out;
}

/**
 * Plays the clip back in Mochi's voice. `onLevel` gets the loudness (0 to 1) about ten times a
 * second, so Mochi's mouth can move with the words. Resolves when it has finished.
 */
export async function echoBack(clip: Blob, voice: EchoVoice, onLevel?: (level: number) => void): Promise<void> {
  const a = audioContext();
  if (!a) return;
  await a.resume().catch(() => undefined);
  const v = ECHO_VOICES[voice];
  const buffer = trim(a, await a.decodeAudioData(await clip.arrayBuffer()));
  const source = a.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = v.rate;
  const gain = a.createGain();
  gain.gain.value = 1.4;
  const analyser = a.createAnalyser();
  analyser.fftSize = 512;
  source.connect(gain).connect(analyser).connect(a.destination);
  let tail = 0;
  if (v.echo) {
    const delay = a.createDelay(1);
    const feedback = a.createGain();
    delay.delayTime.value = 0.26;
    feedback.gain.value = 0.42;
    gain.connect(delay).connect(feedback).connect(delay);
    feedback.connect(a.destination);
    tail = 900;
  }
  const samples = new Float32Array(analyser.fftSize);
  const meter = onLevel
    ? window.setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const s of samples) sum += s * s;
        onLevel(Math.sqrt(sum / samples.length));
      }, 90)
    : undefined;
  await new Promise<void>((resolve) => {
    source.onended = () => window.setTimeout(resolve, tail);
    source.start();
    // Never get stuck if the end isn't reported.
    window.setTimeout(resolve, (buffer.duration / v.rate) * 1000 + tail + 1500);
  });
  window.clearInterval(meter);
  onLevel?.(0);
  source.disconnect();
  gain.disconnect();
}
