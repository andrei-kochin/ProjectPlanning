/**
 * Auth is pluggable: the app only talks to an AuthProvider. The first implementation stores a
 * user-pasted PAT in localStorage; an OAuth/GitHub App device-flow provider can implement the
 * same interface later without touching the views.
 */
export interface AuthProvider {
  readonly kind: string;
  getToken(): string | null;
  /** For the PAT provider, `credential` is the token. Other providers may ignore it and redirect. */
  signIn(credential?: string): Promise<void>;
  signOut(): void;
  subscribe(listener: () => void): () => void;
}

const STORAGE_KEY = 'projectplanning.github-token';

export class PatAuthProvider implements AuthProvider {
  readonly kind = 'pat';
  private listeners = new Set<() => void>();

  constructor(private storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = window.localStorage) {}

  getToken(): string | null {
    return this.storage.getItem(STORAGE_KEY);
  }

  async signIn(credential?: string): Promise<void> {
    const token = credential?.trim();
    if (!token) throw new Error('Paste a GitHub token first');
    this.storage.setItem(STORAGE_KEY, token);
    this.emit();
  }

  signOut(): void {
    this.storage.removeItem(STORAGE_KEY);
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
