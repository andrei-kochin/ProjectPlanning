/**
 * Pulls every project in projects.yml from GitHub GraphQL and writes static JSON for the site:
 *   public/data/index.json        project list for the dropdown
 *   public/data/<id>.json         normalized issues + Status / Due date / Iteration
 *
 * Usage:
 *   PROJECTS_TOKEN=... npm run sync     live data
 *   npm run data:fixtures               bundled fixtures (no token needed)
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseProjectsConfig } from '../src/lib/config';
import { addMissingIssues, fetchBoard } from '../src/lib/fetcher';
import { createGraphQLClient } from '../src/lib/graphql';
import { normalizeBoard, type RawBoard } from '../src/lib/normalize';
import type { ProjectConfig, ProjectData, ProjectIndex, ProjectIndexEntry } from '../src/lib/types';

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const argValue = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const useFixtures = args.includes('--fixtures');
const outDir = path.resolve(root, argValue('--out') ?? 'public/data');
const configPath = path.resolve(root, argValue('--config') ?? 'projects.yml');
const token = process.env.PROJECTS_TOKEN || process.env.GITHUB_TOKEN_PROJECTS;

async function loadFixture(cfg: ProjectConfig): Promise<ProjectData> {
  const file = path.join(root, 'fixtures', `${cfg.id}.graphql.json`);
  if (!existsSync(file)) throw new Error(`No fixture at fixtures/${cfg.id}.graphql.json`);
  const raw = JSON.parse(await readFile(file, 'utf8')) as RawBoard;
  return normalizeBoard(raw, cfg, { fixture: true });
}

async function loadLive(cfg: ProjectConfig): Promise<ProjectData> {
  const gql = createGraphQLClient({ getToken: () => token ?? null });
  let board = await fetchBoard(gql, cfg);
  if (cfg.autoAddIssues) {
    const added = await addMissingIssues(gql, cfg, board);
    console.log(`  added ${added} missing issue(s) to the board`);
    if (added > 0) board = await fetchBoard(gql, cfg);
  }
  return normalizeBoard(board, cfg);
}

async function main() {
  if (!useFixtures && !token) {
    console.error('PROJECTS_TOKEN is not set. Use --fixtures for offline data.');
    process.exit(2);
  }
  const configs = parseProjectsConfig(await readFile(configPath, 'utf8'));
  await mkdir(outDir, { recursive: true });

  const entries: ProjectIndexEntry[] = [];
  for (const cfg of configs) {
    console.log(`${cfg.id}: ${useFixtures ? 'fixture' : `${cfg.board.ownerType}/${cfg.board.owner} #${cfg.board.number}`}`);
    try {
      const data = useFixtures ? await loadFixture(cfg) : await loadLive(cfg);
      await writeFile(path.join(outDir, `${cfg.id}.json`), JSON.stringify(data, null, 1));
      for (const w of data.warnings) console.warn(`  warning: ${w}`);
      console.log(`  ${data.items.length} issue(s)`);
      entries.push({ id: cfg.id, name: cfg.name, repos: cfg.repos, generatedAt: data.generatedAt, fixture: data.fixture, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  failed: ${message}`);
      entries.push({ id: cfg.id, name: cfg.name, repos: cfg.repos, generatedAt: null, fixture: useFixtures, error: message });
    }
  }

  const index: ProjectIndex = { generatedAt: new Date().toISOString(), projects: entries };
  await writeFile(path.join(outDir, 'index.json'), JSON.stringify(index, null, 1));
  console.log(`wrote ${path.relative(root, outDir)}/index.json`);

  if (entries.every((e) => e.error)) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
