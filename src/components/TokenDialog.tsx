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
  const signedIn = !!auth.getToken();

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const probe = createGraphQLClient({ getToken: () => value.trim() });
      await probe(VIEWER_QUERY);
      await auth.signIn(value);
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
            A token is stored in this browser{login ? ` for @${login}` : ''}. Edits on the board are written to GitHub with it.
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
          <p className="muted small">
            The token is kept only in this browser's localStorage and sent only to api.github.com. Anyone with access to this
            browser profile can read it; remove it when you are done on a shared machine.
          </p>
          {error && <div className="banner error inline">{error}</div>}
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
