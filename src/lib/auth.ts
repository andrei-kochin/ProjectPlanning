/**
 * Auth is pluggable: the app only talks to an AuthProvider. The first implementation holds a
 * user-pasted PAT; an OAuth/GitHub App provider can implement the same interface later without
 * touching the views.
 */
export interface SignInOptions {
  /** Persist the credential across reloads on this device. */
  remember?: boolean;
}

export interface AuthProvider {
  readonly kind: string;
  getToken(): string | null;
  /** Whether the current credential is persisted beyond this page load. */
  isRemembered(): boolean;
  /** For the PAT provider, `credential` is the token. Other providers may ignore it and redirect. */
  signIn(credential?: string, options?: SignInOptions): Promise<void>;
  signOut(): void;
  subscribe(listener: () => void): () => void;
}

const STORAGE_KEY = 'projectplanning.github-token';

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Keeps the token in memory by default, so it is gone on reload. `localStorage` is shared by every
 * page on the origin (all project Pages sites under <user>.github.io), so persisting is opt-in.
 */
export class PatAuthProvider implements AuthProvider {
  readonly kind = 'pat';
  private memoryToken: string | null = null;
  private listeners = new Set<() => void>();

  constructor(private storage: KeyValueStorage | null = safeLocalStorage()) {}

  getToken(): string | null {
    return this.memoryToken ?? this.storage?.getItem(STORAGE_KEY) ?? null;
  }

  isRemembered(): boolean {
    return !!this.storage?.getItem(STORAGE_KEY);
  }

  async signIn(credential?: string, options: SignInOptions = {}): Promise<void> {
    const token = credential?.trim();
    if (!token) throw new Error('Paste a GitHub token first');
    this.memoryToken = token;
    if (options.remember && this.storage) this.storage.setItem(STORAGE_KEY, token);
    else this.storage?.removeItem(STORAGE_KEY);
    this.emit();
  }

  signOut(): void {
    this.memoryToken = null;
    this.storage?.removeItem(STORAGE_KEY);
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

function safeLocalStorage(): KeyValueStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}
