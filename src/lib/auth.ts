/**
 * Auth is pluggable: the app only talks to an AuthProvider. The first implementation holds a
 * user-pasted PAT; an OAuth/GitHub App provider can implement the same interface later without
 * touching the views.
 */
export interface AuthProvider {
  readonly kind: string;
  getToken(): string | null;
  /** For the PAT provider, `credential` is the token. Other providers may ignore it and redirect. */
  signIn(credential?: string): Promise<void>;
  signOut(): void;
  subscribe(listener: () => void): () => void;
}

/** Key used by earlier builds that could persist the token; removed on startup. */
export const LEGACY_TOKEN_KEY = 'projectplanning.github-token';

type RemovableStorage = Pick<Storage, 'removeItem'>;

/**
 * Keeps the token in memory only, so it is gone on reload. Browser storage is shared by every page
 * on the origin (all project Pages sites under <user>.github.io), so the token is never written there.
 */
export class PatAuthProvider implements AuthProvider {
  readonly kind = 'pat';
  private token: string | null = null;
  private listeners = new Set<() => void>();

  constructor(legacyStorages: RemovableStorage[] = browserStorages()) {
    for (const s of legacyStorages) {
      try {
        s.removeItem(LEGACY_TOKEN_KEY);
      } catch {
        // Storage can throw when disabled; nothing to clean up then.
      }
    }
  }

  getToken(): string | null {
    return this.token;
  }

  async signIn(credential?: string): Promise<void> {
    const token = credential?.trim();
    if (!token) throw new Error('Paste a GitHub token first');
    this.token = token;
    this.emit();
  }

  signOut(): void {
    this.token = null;
    this.emit();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const l of this.listeners) l();
  }
}

function browserStorages(): RemovableStorage[] {
  if (typeof window === 'undefined') return [];
  const out: RemovableStorage[] = [];
  for (const get of [() => window.localStorage, () => window.sessionStorage]) {
    try {
      out.push(get());
    } catch {
      // Accessing storage throws when it is blocked.
    }
  }
  return out;
}
