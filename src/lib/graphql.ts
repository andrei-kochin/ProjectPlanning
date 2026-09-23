export type GraphQLFn = <T = any>(query: string, variables?: Record<string, unknown>) => Promise<T>;

export class GraphQLError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors: unknown[] = [],
  ) {
    super(message);
    this.name = 'GraphQLError';
  }
}

export interface GraphQLClientOptions {
  getToken: () => Promise<string | null> | string | null;
  endpoint?: string;
  fetchImpl?: typeof fetch;
}

/** Minimal GitHub GraphQL client; works in the browser and in Node >= 18. */
export function createGraphQLClient(opts: GraphQLClientOptions): GraphQLFn {
  const endpoint = opts.endpoint ?? 'https://api.github.com/graphql';
  const doFetch = opts.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  return async (query, variables = {}) => {
    const token = await opts.getToken();
    if (!token) throw new GraphQLError('Not signed in: no GitHub token available', 401);
    const res = await doFetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });
    const body = (await res.json().catch(() => ({}))) as { data?: any; errors?: { message: string }[]; message?: string };
    if (!res.ok) {
      throw new GraphQLError(body.message ?? `GitHub API returned HTTP ${res.status}`, res.status, body.errors);
    }
    if (body.errors?.length) {
      throw new GraphQLError(body.errors.map((e) => e.message).join('; '), res.status, body.errors);
    }
    return body.data;
  };
}
