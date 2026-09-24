import { useState } from 'react';
import type { AuthProvider } from '../lib/auth';
import { createGraphQLClient } from '../lib/graphql';
import { VIEWER_QUERY } from '../lib/queries';
import { Modal } from './Modal';

interface Props {
  auth: AuthProvider;
  login: string | null;
  onClose: () => void;
}

export function TokenDialog({ auth, login, onClose }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(false);
  const signedIn = !!auth.getToken();

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const probe = createGraphQLClient({ getToken: () => value.trim() });
      await probe(VIEWER_QUERY);
      await auth.signIn(value, { remember });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="GitHub access" onClose={onClose}>
      {signedIn ? (
        <div className="token-state">
          <p>
            A token is in use{login ? ` for @${login}` : ''}.{' '}
            {auth.isRemembered()
              ? "It is remembered in this browser's localStorage until you remove it."
              : 'It is kept in memory only and is forgotten when you reload or close this page.'}{' '}
            Edits on the board are written to GitHub with it.
          </p>
          <button
            className="btn danger"
            onClick={() => {
              auth.signOut();
              onClose();
            }}
          >
            Remove token
          </button>
        </div>
      ) : (
        <form
          className="editor"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="small">
            Paste a GitHub personal access token. It needs <strong>read access to the source repo's issues</strong> and{' '}
            <strong>read/write access to the Projects board</strong>. With a classic PAT that means the <code>repo</code> and{' '}
            <code>project</code> scopes. See the README for details.
          </p>
          <label>
            <span>Token</span>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="ghp_… or github_pat_…"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          </label>
          <label className="check remember">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember on this device
          </label>
          <p className="muted small">
            The token is sent only to api.github.com. By default it is kept in memory and forgotten on reload. If you choose to
            remember it, it goes into <code>localStorage</code>, which every page on this origin can read, including other
            GitHub Pages sites under the same <code>&lt;user&gt;.github.io</code> account. Only remember it on a trusted device
            if you don't host untrusted Pages sites under the same account.
          </p>
          {error && (
            <div className="banner error inline" role="alert">
              {error}
            </div>
          )}
          <footer>
            <div className="spacer" />
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={!value.trim() || busy}>
              {busy ? 'Checking…' : 'Verify & save'}
            </button>
          </footer>
        </form>
      )}
    </Modal>
  );
}
