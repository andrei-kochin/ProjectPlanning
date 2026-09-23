import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { AuthProvider } from './lib/auth';
import { fetchBoard } from './lib/fetcher';
import { createGraphQLClient } from './lib/graphql';
import { saveItemPatch } from './lib/mutations';
import { normalizeBoard } from './lib/normalize';
import { VIEWER_QUERY } from './lib/queries';
import type { PlanItem, ProjectData, ProjectIndex } from './lib/types';
import { applyItemPatch, filterItems, type ItemFilter, type ItemPatch } from './lib/views';
import { FilterBar } from './components/FilterBar';
import { Gantt } from './components/Gantt';
import { ItemEditor } from './components/ItemEditor';
import { Kanban } from './components/Kanban';
import { TokenDialog } from './components/TokenDialog';

type View = 'kanban' | 'gantt';
type Toast = { kind: 'ok' | 'info' | 'error'; text: string };

const dataUrl = (file: string) => `${import.meta.env.BASE_URL}data/${file}`;

async function getJson<T>(file: string): Promise<T> {
  const res = await fetch(dataUrl(file), { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load ${file} (HTTP ${res.status})`);
  return res.json() as Promise<T>;
}

function readUrl(): { project: string | null; view: View } {
  const q = new URLSearchParams(window.location.search);
  return { project: q.get('project'), view: q.get('view') === 'gantt' ? 'gantt' : 'kanban' };
}

function formatStamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function App({ auth }: { auth: AuthProvider }) {
  const initial = useMemo(readUrl, []);
  const [index, setIndex] = useState<ProjectIndex | null>(null);
  const [projectId, setProjectId] = useState<string | null>(initial.project);
  const [view, setView] = useState<View>(initial.view);
  const [data, setData] = useState<ProjectData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ItemFilter>({ showClosed: false });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<Toast | null>(null);
  const [tokenOpen, setTokenOpen] = useState(false);
  const [login, setLogin] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const token = useSyncExternalStore(
    (cb) => auth.subscribe(cb),
    () => auth.getToken(),
  );
  const gql = useMemo(() => createGraphQLClient({ getToken: () => auth.getToken() }), [auth]);

  useEffect(() => {
    getJson<ProjectIndex>('index.json')
      .then((idx) => {
        setIndex(idx);
        setProjectId((cur) => (cur && idx.projects.some((p) => p.id === cur) ? cur : idx.projects[0]?.id ?? null));
      })
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    setData(null);
    setLoadError(null);
    const entry = index?.projects.find((p) => p.id === projectId);
    if (entry?.error) {
      setLoadError(`Last sync failed for ${entry.name}: ${entry.error}`);
      return;
    }
    getJson<ProjectData>(`${projectId}.json`)
      .then(setData)
      .catch((e: Error) => setLoadError(e.message));
  }, [projectId, index]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (projectId) q.set('project', projectId);
    q.set('view', view);
    window.history.replaceState(null, '', `${window.location.pathname}?${q}`);
  }, [projectId, view]);

  useEffect(() => {
    setLogin(null);
    if (!token) return;
    gql<{ viewer: { login: string } }>(VIEWER_QUERY)
      .then((d) => setLogin(d.viewer.login))
      .catch(() => setLogin(null));
  }, [token, gql]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.kind === 'error' ? 8000 : 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const save = useCallback(
    async (item: PlanItem, patch: ItemPatch) => {
      if (!data) return;
      const original: ItemPatch = {};
      for (const k of Object.keys(patch) as (keyof ItemPatch)[]) (original as any)[k] = item[k];
      const label = `#${item.issue.number}`;

      if (data.fixture) {
        setData((d) => d && applyItemPatch(d, item.itemId, patch));
        setToast({ kind: 'info', text: `Demo data: ${label} updated in this tab only (not saved to GitHub).` });
        return;
      }
      if (!auth.getToken()) {
        setTokenOpen(true);
        setToast({ kind: 'info', text: 'Add a GitHub token to edit the board.' });
        return;
      }
      setData((d) => d && applyItemPatch(d, item.itemId, patch));
      setSavingIds((s) => new Set(s).add(item.itemId));
      try {
        await saveItemPatch(gql, data, item.itemId, patch);
        setToast({ kind: 'ok', text: `Saved ${label} to GitHub.` });
      } catch (e) {
        setData((d) => d && applyItemPatch(d, item.itemId, original));
        setToast({ kind: 'error', text: `Could not save ${label}: ${(e as Error).message}` });
      } finally {
        setSavingIds((s) => {
          const n = new Set(s);
          n.delete(item.itemId);
          return n;
        });
      }
    },
    [data, auth, gql],
  );

  const refreshLive = async () => {
    if (!data) return;
    setRefreshing(true);
    try {
      const board = await fetchBoard(gql, data.config);
      setData(normalizeBoard(board, data.config));
      setToast({ kind: 'ok', text: 'Loaded live data from GitHub.' });
    } catch (e) {
      setToast({ kind: 'error', text: `Live refresh failed: ${(e as Error).message}` });
    } finally {
      setRefreshing(false);
    }
  };

  const visible = useMemo(() => (data ? filterItems(data.items, filter) : []), [data, filter]);
  const editing = data?.items.find((i) => i.itemId === editingId) ?? null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <svg className="logo" viewBox="0 0 16 16" width="18" height="18" aria-hidden>
            <rect x="1" y="2" width="4" height="12" rx="1" fill="#2f81f7" />
            <rect x="6" y="2" width="4" height="8" rx="1" fill="#a371f7" />
            <rect x="11" y="2" width="4" height="5" rx="1" fill="#3fb950" />
          </svg>
          Project Planning
        </div>
        <label className="project-select">
          <span className="sr-only">Project</span>
          <select value={projectId ?? ''} onChange={(e) => setProjectId(e.target.value)} disabled={!index}>
            {index?.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <nav className="tabs" role="tablist">
          {(['kanban', 'gantt'] as View[]).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
              {v === 'kanban' ? 'Kanban' : 'Gantt'}
            </button>
          ))}
        </nav>
        <div className="spacer" />
        {token && data && (
          <button className="btn ghost" onClick={refreshLive} disabled={refreshing} title="Fetch the board directly from GitHub">
            {refreshing ? 'Refreshing…' : 'Refresh live'}
          </button>
        )}
        <button className={`btn ${token ? 'ghost' : 'primary'}`} onClick={() => setTokenOpen(true)}>
          {token ? (login ? `@${login}` : 'Token set') : 'Sign in to edit'}
        </button>
      </header>

      {data && (
        <div className="subbar">
          <div className="meta">
            <a href={data.board.url} target="_blank" rel="noreferrer">
              {data.board.title}
            </a>
            <span className="dot">·</span>
            {data.repos.map((r) => (
              <a key={r} href={`https://github.com/${r}/issues`} target="_blank" rel="noreferrer" className="repo">
                {r}
              </a>
            ))}
            <span className="dot">·</span>
            <span title={data.generatedAt}>synced {formatStamp(data.generatedAt)}</span>
          </div>
          <FilterBar items={data.items} filter={filter} onChange={setFilter} count={visible.length} />
        </div>
      )}

      {data?.fixture && (
        <div className="banner info">
          Showing <strong>fixture data</strong>: the sync has not run with a real token yet. Edits stay in this tab.
        </div>
      )}
      {data?.warnings.map((w) => (
        <div key={w} className="banner warn">
          {w}
        </div>
      ))}
      {loadError && <div className="banner error">{loadError}</div>}

      <main className="content">
        {!data && !loadError && <div className="empty">Loading…</div>}
        {data && view === 'kanban' && (
          <Kanban
            data={data}
            items={visible}
            savingIds={savingIds}
            onMove={(item, statusOptionId) => save(item, { statusOptionId })}
            onOpen={(item) => setEditingId(item.itemId)}
          />
        )}
        {data && view === 'gantt' && <Gantt data={data} items={visible} onOpen={(item) => setEditingId(item.itemId)} />}
      </main>

      {editing && data && (
        <ItemEditor
          data={data}
          item={editing}
          saving={savingIds.has(editing.itemId)}
          onClose={() => setEditingId(null)}
          onSave={async (patch) => {
            setEditingId(null);
            await save(editing, patch);
          }}
        />
      )}
      {tokenOpen && <TokenDialog auth={auth} login={login} onClose={() => setTokenOpen(false)} />}
      {toast && (
        <div className={`toast ${toast.kind}`} role="status" onClick={() => setToast(null)}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
