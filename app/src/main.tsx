import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Self-hosted fonts (no Google Fonts requests): the weights tokens.css and the screens use.
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/400-italic.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import '@fontsource/schibsted-grotesk/400.css';
import '@fontsource/schibsted-grotesk/600.css';
import '@fontsource/schibsted-grotesk/700.css';
import '@fontsource/schibsted-grotesk/800.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';

import '../../design/tokens.css';
import './styles/app.css';

import type { ReactNode } from 'react';
import { MOCHI_CSS } from '../../design/mochi/mochi';
import { createAppClient } from './lib/app-client';
import { errorText } from './lib/format';
import { TARGET } from './lib/platform';
import { AppProvider } from './state';
import { App, Splash } from './App';

// The website installs as an app (public/sw.js). The Android and Windows apps carry their own copy.
if (TARGET === 'web' && import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}

// Mochi's float, bounce and thinking-dot animations, once per page (reduced motion handled inside).
const mochiStyle = document.createElement('style');
mochiStyle.textContent = MOCHI_CSS;
document.head.appendChild(mochiStyle);

const root = createRoot(document.getElementById('root')!);
const render = (node: ReactNode) =>
  root.render(
    <StrictMode>
      <div className="app-column">{node}</div>
    </StrictMode>,
  );

render(<Splash text="Opening Ownling…" />);
createAppClient()
  .then((client) =>
    render(
      <AppProvider client={client}>
        <App />
      </AppProvider>,
    ),
  )
  .catch((e) =>
    render(
      <main className="screen screen--splash">
        <h1 className="title center">Ownling can't start</h1>
        <p className="error center" role="alert">
          {errorText(e)}
        </p>
      </main>,
    ),
  );
