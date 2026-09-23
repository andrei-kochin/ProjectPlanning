import type { GraphQLFn } from './graphql';
import { ADD_ITEM_MUTATION, boardQuery, REPO_OPEN_ISSUES_QUERY } from './queries';
import type { ProjectConfig } from './types';
import type { RawBoard, RawItem } from './normalize';

/** Fetches a Projects v2 board with all items (paginated) in the raw GraphQL shape. */
export async function fetchBoard(gql: GraphQLFn, cfg: ProjectConfig): Promise<RawBoard> {
  const query = boardQuery(cfg.board.ownerType);
  const items: RawItem[] = [];
  let after: string | null = null;
  let board: Omit<RawBoard, 'items'> | null = null;
  for (let page = 0; page < 100; page++) {
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
    if (!pageItems.pageInfo.hasNextPage) break;
    after = pageItems.pageInfo.endCursor;
  }
  return { ...board!, items: { nodes: items } };
}

async function fetchOpenIssueIds(gql: GraphQLFn, repo: string): Promise<{ id: string; number: number }[]> {
  const [owner, name] = repo.split('/');
  const out: { id: string; number: number }[] = [];
  let after: string | null = null;
  for (let page = 0; page < 100; page++) {
    const data: any = await gql(REPO_OPEN_ISSUES_QUERY, { owner, name, after });
    const issues = data?.repository?.issues;
    if (!issues) throw new Error(`Repository ${repo} not found or its issues are not readable with this token`);
    out.push(...issues.nodes);
    if (!issues.pageInfo.hasNextPage) break;
    after = issues.pageInfo.endCursor;
  }
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
