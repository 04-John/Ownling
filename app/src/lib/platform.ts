// Where this copy of the app runs. The website, the Android app and the Windows app are the same
// build with a different VITE_TARGET; the native apps call the hosted kitchen by its full address.
export type Target = 'web' | 'android' | 'windows';

export const TARGET: Target = (import.meta.env.VITE_TARGET as Target | undefined) ?? 'web';

/** Release files are attached to GitHub releases; `latest/download` always points at the newest. */
const DOWNLOAD_BASE: string =
  import.meta.env.VITE_DOWNLOAD_BASE ?? 'https://github.com/04-John/Ownling/releases/latest/download';

export const DOWNLOADS = {
  android: `${DOWNLOAD_BASE}/Ownling.apk`,
  windows: `${DOWNLOAD_BASE}/Ownling-Setup.exe`,
};

/** True when the website is already running as an installed app. */
export const runningInstalled = (): boolean =>
  TARGET !== 'web' || window.matchMedia('(display-mode: standalone)').matches;

export const isAppleMobile = (): boolean =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
