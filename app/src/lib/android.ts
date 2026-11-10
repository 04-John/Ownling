// Android's Back button: go back one screen, and from a first screen (Welcome or Home) send the app
// to the background, as Android apps do. Loaded only in the Android app (main.tsx).
import { App } from '@capacitor/app';

const FIRST_SCREENS = new Set(['/', '/welcome', '/home']);

export function handleBackButton(): void {
  App.addListener('backButton', ({ canGoBack }) => {
    const path = (window.location.hash.replace(/^#/, '') || '/').split('?')[0];
    if (FIRST_SCREENS.has(path) || !canGoBack) App.minimizeApp();
    else window.history.back();
  });
}
