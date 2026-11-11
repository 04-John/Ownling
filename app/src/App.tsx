// Routes and guards. Welcome → Recovery → Adopt → Home. From Home: Feed sheet, Play sheet (→ Talk
// with ?game=), Talk, Wardrobe, Diary, Ownership (→ Give, → Recovery). When the pet hibernates,
// Home shows the Hibernating screen.
// Download (get the app) opens from anywhere, signed in or not.
import { Component, useEffect, useRef, type ReactNode } from 'react';
import { useApp } from './state';
import { navigate, useRoute } from './lib/router';
import { errorText } from './lib/format';
import { LogoMark } from './components/Icons';
import { Button } from './components/ui';
import { Welcome } from './screens/Welcome';
import { Restore } from './screens/Restore';
import { Recovery } from './screens/Recovery';
import { Adopt } from './screens/Adopt';
import { HomeRoute } from './screens/Home';
import { FeedSheet } from './screens/FeedSheet';
import { Talk } from './screens/Talk';
import { Diary } from './screens/Diary';
import { Ownership } from './screens/Ownership';
import { Give } from './screens/Give';
import { Download } from './screens/Download';
import { Games } from './screens/Games';
import { Wardrobe } from './screens/Wardrobe';

const NEEDS_PET = new Set(['/home', '/feed', '/play', '/talk', '/wardrobe', '/diary', '/ownership', '/give']);

function Redirect({ to }: { to: string }) {
  useEffect(() => navigate(to, { replace: true }), [to]);
  return null;
}

export function Splash({ text = 'Loading Mochi…' }: { text?: string }) {
  return (
    <main className="screen screen--splash" aria-busy="true">
      <LogoMark size={56} />
      <p className="sub" role="status">
        {text}
      </p>
    </main>
  );
}

function PetLoadError() {
  const { petError, reloadPet, client, setAccount } = useApp();
  return (
    <main className="screen screen--splash">
      <LogoMark size={56} />
      <h1 className="title center" tabIndex={-1}>
        Mochi didn't load
      </h1>
      <p className="error center" role="alert">
        {petError}
      </p>
      <Button onClick={() => reloadPet().catch(() => undefined)}>Try again</Button>
      <button
        type="button"
        className="text-button"
        onClick={() => {
          client.signOut();
          setAccount(null);
          navigate('/', { replace: true });
        }}
      >
        Sign out
      </button>
    </main>
  );
}

export function App() {
  const { account, pet, petStatus, reloadPet } = useApp();
  const route = useRoute();
  const { path } = route;

  // Load the pet once for an account that was already signed in on this device.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !account || petStatus !== 'loading') return;
    started.current = true;
    reloadPet().catch(() => undefined);
  }, [account, petStatus, reloadPet]);

  // Each screen starts at the top, with focus on its heading for screen readers.
  useEffect(() => {
    window.scrollTo(0, 0);
    const h = document.querySelector<HTMLElement>('main h1');
    h?.focus({ preventScroll: true });
  }, [path]);

  if (account && petStatus === 'loading' && !pet) return <Splash />;
  if (account && petStatus === 'error' && !pet) return <PetLoadError />;

  let screen: ReactNode;
  if (path === '/download') {
    screen = <Download />;
  } else if (path === '/' || path === '/welcome' || path === '/restore') {
    if (account) return <Redirect to={pet ? '/home' : '/adopt'} />;
    screen = path === '/restore' ? <Restore /> : <Welcome />;
  } else if (!account) {
    return <Redirect to="/" />;
  } else if (path === '/recovery') {
    screen = <Recovery fromOwnership={route.query.get('from') === 'ownership'} />;
  } else if (path === '/adopt') {
    if (pet) return <Redirect to="/home" />;
    screen = <Adopt />;
  } else if (NEEDS_PET.has(path)) {
    if (!pet) return <Redirect to="/adopt" />;
    screen =
      path === '/home' ? <HomeRoute />
      : path === '/feed' ? <FeedSheet />
      : path === '/play' ? <Games />
      : path === '/wardrobe' ? <Wardrobe />
      : path === '/talk' ? <Talk />
      : path === '/diary' ? <Diary />
      : path === '/ownership' ? <Ownership />
      : <Give />;
  } else {
    return <Redirect to="/" />;
  }

  return <ScreenBoundary key={path}>{screen}</ScreenBoundary>;
}

/** Keeps one broken screen from blanking the app. */
class ScreenBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  render() {
    if (this.state.error == null) return this.props.children;
    return (
      <main className="screen screen--splash">
        <h1 className="title center" tabIndex={-1}>
          This screen hit a problem
        </h1>
        <p className="error center" role="alert">
          {errorText(this.state.error)}
        </p>
        <a className="btn btn--primary" href="#/home" onClick={() => this.setState({ error: null })}>
          Go home
        </a>
      </main>
    );
  }
}
