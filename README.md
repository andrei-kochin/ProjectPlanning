# ProjectPlanning

A static planning site for the supervised repos' GitHub issues, deployed on GitHub Pages. It has:

- **Kanban**: one column per option of the board's **Status** field. Dragging a card to another column updates Status on GitHub.
- **Gantt**: each issue's bar runs from its **first assignment** (the first `assigned` event in the issue timeline) to the board's **Due date**. Bars are grouped by the **Iteration** field (sprints/stages).
- A **project dropdown** to switch between the projects listed in [`projects.yml`](projects.yml).
- **Editing**: Status, Due date and Iteration can be changed from the site. Edits are written to the Projects (v2) board with a token pasted into the browser.

The planning fields live on a **GitHub Projects (v2) board**, not in the repo. That means the board can be owned by you even when the issues live in a repo you cannot administer.

```
projects.yml ──► scripts/sync.ts (GitHub Action, hourly) ──► public/data/*.json ──► Vite build ──► GitHub Pages
                                                                                        │
             browser with a pasted token ◄── GraphQL mutations (Status / Due date / Iteration) ──┘
```

## Setup

### 1. Create the Projects board (user-owned, tracking a remote repo)

This is for the case where you are only a collaborator on the issue repo (e.g. `itikhono/benchmark`) and cannot create projects there.

1. Go to **your profile → Projects → New project**, pick the *Board* template and give it a name. It is created under `https://github.com/users/<you>/projects/<N>`. Note down **N**.
2. Configure the fields (click `+` on the table header, or open **⋯ → Settings → Custom fields**):
   - **Status**: exists by default. Edit its options to the columns you want, e.g. `Todo`, `In Progress`, `Blocked`, `In Review`, `Done`. Column order on the site follows the option order.
   - **Due date**: a new field of type **Date**.
   - **Iteration**: a new field of type **Iteration**, e.g. 2-week sprints. Past iterations still show in the Gantt as completed.
3. Add the repo's issues to the board. Either:
   - In the board, click **+ Add item**, type `#`, pick the repo, and select issues (or paste an issue URL), or
   - Use **⋯ → Workflows → Auto-add to project** if it offers the repo, or
   - Set `autoAddIssues: true` in `projects.yml`. The hourly sync then adds every open issue of the configured repos that is not on the board yet. This needs a token with Projects write access.
4. If the field names differ from `Status` / `Due date` / `Iteration`, set them under `fields:` in `projects.yml`.

### 2. Configure `projects.yml`

```yaml
projects:
  - id: benchmark            # used in ?project=benchmark and the data file name
    name: Benchmark          # shown in the dropdown
    repos: [itikhono/benchmark]
    board: { owner: andrei-kochin, ownerType: user, number: 1 }
    fields: { status: Status, dueDate: Due date, iteration: Iteration }
    autoAddIssues: false
```

Add another list entry to supervise another project. Only issues from `repos` are shown, even if the board holds more.

### 3. Create the token and the `PROJECTS_TOKEN` secret

The sync Action needs to read the issues (including their timelines) and the board.

**Use a classic personal access token** (Settings → Developer settings → Personal access tokens → Tokens (classic)) with these scopes:

| Scope | Why |
| --- | --- |
| `repo` | read issues and timelines of the **private** source repo (classic tokens have no read-only private-repo scope) |
| `read:project` | read the board, or **`project`** if `autoAddIssues: true` (adds items) |

A **fine-grained PAT is usually not an option here.** Fine-grained tokens are bound to one resource owner (you, or one org) and can only reach repos owned by it. A private repo owned by *another user* (such as `itikhono/benchmark`) cannot be selected even if you are a collaborator. Fine-grained tokens also have limited support for user-owned Projects v2. If the issue repo and the board both belong to an organization, a fine-grained token with *Repository → Issues: Read* and *Organization → Projects: Read/Write* for that org does work.

Then in this repo go to **Settings → Secrets and variables → Actions → New repository secret**, name it **`PROJECTS_TOKEN`**, and paste the token.

Without the secret, the workflow still deploys, but with the bundled fixture data and a warning. The site shows a "fixture data" banner in that case.

### 4. Enable GitHub Pages

**Settings → Pages → Build and deployment → Source: GitHub Actions.** Then run **Actions → Sync & deploy → Run workflow** once. After that it runs hourly, on every push to `main`, and whenever you trigger it manually.

Notes:

- Pages for a **private** repo requires a paid plan (GitHub Pro/Team/Enterprise). The published site is **public** even when the repo is private, so issue titles, assignees and dates from the synced repos become publicly readable.
- GitHub pauses scheduled workflows in repos with no activity for 60 days. Re-enable the workflow from the Actions tab if that happens.

### 5. Editing from the site

Click **Sign in to edit** and paste a personal token. This is your own token, not the Action's secret. It needs the same access: classic `repo` + `project` (write). The site checks the token against `api.github.com` and stores it **only in this browser's `localStorage`**. It is never committed or sent anywhere else. Use **Remove token** to delete it.

With a token you can:

- drag cards between Kanban columns (updates Status),
- click a card or Gantt bar to change Status, Due date or Iteration,
- use **Refresh live** to load the board straight from GitHub instead of waiting for the next hourly sync.

Changes are applied optimistically and rolled back with an error message if GitHub rejects them. On fixture data, edits stay local to the tab.

## Development

```bash
npm ci
npm run data:fixtures   # writes public/data/ from fixtures/ (no token needed)
npm run dev             # http://localhost:5173/?project=benchmark&view=gantt
npm test                # vitest: config parsing, normalization, Kanban/Gantt transforms, mutations
npm run build           # typecheck + production build into dist/
```

Sync real data locally with `PROJECTS_TOKEN=ghp_... npm run sync`. `public/data/` is git-ignored, so synced data is never committed.

`fixtures/benchmark.graphql.json` is a realistic board for `itikhono/benchmark` in the exact raw GraphQL shape the sync receives. Fixture mode therefore goes through the same normalizer as live data. Regenerate it with `npm run fixtures:generate`.

### Layout

| Path | What |
| --- | --- |
| `projects.yml` | supervised projects |
| `scripts/sync.ts` | Action entry point: fetch → normalize → `public/data/<id>.json` + `index.json` |
| `src/lib/queries.ts` | GraphQL queries and mutations |
| `src/lib/fetcher.ts` | paginated board fetch, optional auto-add of missing issues (shared by Node and browser) |
| `src/lib/normalize.ts` | raw GraphQL → `ProjectData` (field lookup by name, first-assigned timestamp, repo filter) |
| `src/lib/views.ts` | Kanban grouping, Gantt layout, filters, local patches |
| `src/lib/mutations.ts` | writes Status / Due date / Iteration back (`updateProjectV2ItemFieldValue` / `clearProjectV2ItemFieldValue`) |
| `src/lib/auth.ts` | `AuthProvider` interface + `PatAuthProvider` |
| `.github/workflows/sync-deploy.yml` | hourly + manual sync, build, Pages deploy |

### Replacing PAT auth with OAuth later

The UI only depends on the `AuthProvider` interface in `src/lib/auth.ts` (`getToken`, `signIn`, `signOut`, `subscribe`). An OAuth or GitHub App provider can implement it and be passed to `<App auth={...}>` in `src/main.tsx`. GitHub's OAuth code exchange and device-flow endpoints do not allow browser CORS requests, so an OAuth provider needs a small token-exchange proxy (e.g. a Cloudflare Worker) next to the static site.
