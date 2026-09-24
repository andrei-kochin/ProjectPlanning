import type { GraphQLFn } from './graphql';
import { ADD_ITEM_MUTATION, boardQuery, REPO_OPEN_ISSUES_QUERY } from './queries';
import type { ProjectConfig } from './types';
import type { RawBoard, RawItem } from './normalize';

interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

/** Returns the next cursor, or null when done. Throws instead of looping forever or truncating. */
export function nextCursor(pageInfo: PageInfo, seen: Set<string>, what: string): string | null {
  if (!pageInfo.hasNextPage) return null;
  const c = pageInfo.endCursor;
  if (!c) throw new Error(`Pagination of ${what} reported more pages but returned no cursor`);
  if (seen.has(c)) throw new Error(`Pagination of ${what} repeated cursor ${c}; aborting instead of returning partial data`);
  seen.add(c);
  return c;
}

/** Fetches a Projects v2 board with all items (paginated) in the raw GraphQL shape. */
export async function fetchBoard(gql: GraphQLFn, cfg: ProjectConfig): Promise<RawBoard> {
  const query = boardQuery(cfg.board.ownerType);
  const items: RawItem[] = [];
  let after: string | null = null;
  let board: Omit<RawBoard, 'items'> | null = null;
  const seen = new Set<string>();
  do {
    const data: any = await gql(query, { owner: cfg.board.owner, number: cfg.board.number, after });
    const project = data?.owner?.projectV2;
    if (!project) {
      throw new Error(
        `Project board ${cfg.board.ownerType}/${cfg.board.owner} #${cfg.board.number} not found or not accessible with this token`,
      );
    }
    const { items: pageItems, ...rest } = project;
    board ??= rest;
    items.push(...pageItems.nodes);
    after = nextCursor(pageItems.pageInfo, seen, `board #${cfg.board.number} items`);
  } while (after);
  return { ...board!, items: { nodes: items } };
}

async function fetchOpenIssueIds(gql: GraphQLFn, repo: string): Promise<{ id: string; number: number }[]> {
  const [owner, name] = repo.split('/');
  const out: { id: string; number: number }[] = [];
  let after: string | null = null;
  const seen = new Set<string>();
  do {
    const data: any = await gql(REPO_OPEN_ISSUES_QUERY, { owner, name, after });
    const issues = data?.repository?.issues;
    if (!issues) throw new Error(`Repository ${repo} not found or its issues are not readable with this token`);
    out.push(...issues.nodes);
    after = nextCursor(issues.pageInfo, seen, `${repo} issues`);
  } while (after);
  return out;
}

/** Adds open issues from the configured repos that are missing from the board. Returns how many were added. */
export async function addMissingIssues(gql: GraphQLFn, cfg: ProjectConfig, board: RawBoard): Promise<number> {
  const onBoard = new Set(
    board.items.nodes.map((n) => (n?.content && 'id' in n.content ? n.content.id : null)).filter(Boolean),
  );
  let added = 0;
  for (const repo of cfg.repos) {
    for (const issue of await fetchOpenIssueIds(gql, repo)) {
      if (onBoard.has(issue.id)) continue;
      await gql(ADD_ITEM_MUTATION, { projectId: board.id, contentId: issue.id });
      added++;
    }
  }
  return added;
}
