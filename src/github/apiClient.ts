import type {
  BranchRef,
  CandidateCommit,
  ChangedFile,
  ForkRef,
  RepositoryRef
} from "../domain/types.js";
import { GitHubApiError, redactSecretsFromError } from "./errors.js";
import type {
  BranchComparison,
  GitHubReadClient,
  GitHubRepository
} from "./types.js";

type FetchFunction = (
  input: string | URL,
  init?: RequestInit
) => Promise<Response>;

interface GitHubClientOptions {
  token: string | null;
  timeoutMs: number;
  apiBaseUrl?: string;
  fetchFn?: FetchFunction;
}

interface GitHubRepositoryResponse {
  default_branch?: string;
}

interface GitHubOwnerResponse {
  login?: string;
}

interface GitHubForkResponse {
  owner?: GitHubOwnerResponse;
  name?: string;
  full_name?: string;
  default_branch?: string;
  pushed_at?: string | null;
}

interface GitHubBranchResponse {
  name?: string;
  commit?: {
    sha?: string;
  };
}

interface GitHubCompareResponse {
  html_url?: string;
  ahead_by?: number;
  behind_by?: number;
  total_commits?: number;
  commits?: GitHubCommitResponse[];
  files?: GitHubChangedFileResponse[];
}

interface GitHubCommitResponse {
  sha?: string;
  commit?: {
    message?: string;
    author?: {
      date?: string | null;
    } | null;
    committer?: {
      date?: string | null;
    } | null;
  };
}

interface GitHubChangedFileResponse {
  filename?: string;
  status?: string;
  additions?: number;
  deletions?: number;
  changes?: number;
  patch?: string;
  previous_filename?: string;
}

interface GitHubErrorBody {
  message?: string;
}

export class GitHubClient implements GitHubReadClient {
  private readonly token: string | null;
  private readonly timeoutMs: number;
  private readonly apiBaseUrl: string;
  private readonly fetchFn: FetchFunction;

  public constructor(options: GitHubClientOptions) {
    this.token = options.token;
    this.timeoutMs = options.timeoutMs;
    this.apiBaseUrl = options.apiBaseUrl ?? "https://api.github.com";
    this.fetchFn = options.fetchFn ?? fetch;
  }

  public async fetchRepository(
    repository: RepositoryRef
  ): Promise<GitHubRepository> {
    const response = await this.requestJson<GitHubRepositoryResponse>(
      `/repos/${encodePathSegment(repository.owner)}/${encodePathSegment(
        repository.name
      )}`
    );

    if (typeof response.default_branch !== "string") {
      throw new GitHubApiError(
        `GitHub API response for ${repository.fullName} did not include default_branch.`,
        {
          status: 0,
          code: "api",
          retryAfter: null,
          rateLimitReset: null
        }
      );
    }

    return {
      defaultBranch: response.default_branch
    };
  }

  public async listForks(
    repository: RepositoryRef,
    maxForks: number
  ): Promise<ForkRef[]> {
    const forks = await this.paginate<GitHubForkResponse>(
      `/repos/${encodePathSegment(repository.owner)}/${encodePathSegment(
        repository.name
      )}/forks`,
      {
        sort: "updated"
      },
      maxForks
    );

    return forks.map((fork) => normalizeFork(fork)).sort(compareForks);
  }

  public async listBranches(
    fork: ForkRef,
    maxBranches: number
  ): Promise<BranchRef[]> {
    const branches = await this.paginate<GitHubBranchResponse>(
      `/repos/${encodePathSegment(fork.owner)}/${encodePathSegment(
        fork.name
      )}/branches`,
      {},
      maxBranches
    );

    return branches
      .map((branch) => normalizeBranch(fork, branch))
      .sort(compareBranches);
  }

  public async compareBranch(
    baseRepository: RepositoryRef,
    baseBranch: string,
    sourceBranch: BranchRef
  ): Promise<BranchComparison> {
    const compareSpec = `${encodePathSegment(baseBranch)}...${encodePathSegment(
      `${sourceBranch.repository.owner}:${sourceBranch.name}`
    )}`;
    const response = await this.requestJson<GitHubCompareResponse>(
      `/repos/${encodePathSegment(baseRepository.owner)}/${encodePathSegment(
        baseRepository.name
      )}/compare/${compareSpec}`
    );

    return {
      compareUrl:
        response.html_url ??
        buildCompareUrl(baseRepository, baseBranch, sourceBranch),
      aheadBy: response.ahead_by ?? 0,
      behindBy: response.behind_by ?? 0,
      totalCommits: response.total_commits ?? 0,
      commits: (response.commits ?? []).map(normalizeCommit),
      changedFiles: (response.files ?? []).map(normalizeChangedFile)
    };
  }

  private async paginate<T>(
    path: string,
    parameters: Readonly<Record<string, string>>,
    maxItems: number
  ): Promise<T[]> {
    if (maxItems <= 0) {
      return [];
    }

    const items: T[] = [];
    let page = 1;

    while (items.length < maxItems) {
      const remaining = maxItems - items.length;
      const perPage = Math.min(100, remaining);
      const pageItems = await this.requestJson<T[]>(
        buildPathWithQuery(path, {
          ...parameters,
          page: String(page),
          per_page: String(perPage)
        })
      );

      items.push(...pageItems);

      if (pageItems.length < perPage) {
        break;
      }

      page += 1;
    }

    return items;
  }

  private async requestJson<T>(path: string): Promise<T> {
    const url = path.startsWith("http")
      ? new URL(path)
      : new URL(path, this.apiBaseUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchFn(url, {
        headers: this.createHeaders(),
        method: "GET",
        signal: controller.signal
      });

      if (!response.ok) {
        throw await this.createApiError(response, url);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new GitHubApiError(
          `GitHub API request timed out after ${this.timeoutMs}ms: ${url.pathname}`,
          {
            status: 0,
            code: "timeout",
            retryAfter: null,
            rateLimitReset: null
          }
        );
      }

      if (error instanceof GitHubApiError) {
        throw error;
      }

      const message =
        error instanceof Error ? error.message : "Unknown network error";
      throw new GitHubApiError(
        redactSecretsFromError(`Could not reach GitHub API: ${message}`, [
          this.token
        ]),
        {
          status: 0,
          code: "api",
          retryAfter: null,
          rateLimitReset: null
        }
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private createHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "patch-radar/0.1",
      "X-GitHub-Api-Version": "2022-11-28"
    };

    if (this.token !== null) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return headers;
  }

  private async createApiError(
    response: Response,
    url: URL
  ): Promise<GitHubApiError> {
    const rawBody = await response.text();
    const message = parseGitHubErrorMessage(rawBody);
    const retryAfter = response.headers.get("retry-after");
    const rateLimitReset = parseRateLimitReset(
      response.headers.get("x-ratelimit-reset")
    );
    const code = classifyGitHubError(response, message);
    const statusText =
      response.statusText.length > 0 ? response.statusText : code;
    const retryDetails =
      retryAfter === null && rateLimitReset === null
        ? ""
        : ` Retry after: ${retryAfter ?? rateLimitReset}.`;

    return new GitHubApiError(
      redactSecretsFromError(
        `GitHub API ${response.status} ${statusText} for ${url.pathname}: ${message}.${retryDetails}`,
        [this.token]
      ),
      {
        status: response.status,
        code,
        retryAfter,
        rateLimitReset
      }
    );
  }
}

function normalizeFork(response: GitHubForkResponse): ForkRef {
  const owner = response.owner?.login ?? "unknown";
  const name = response.name ?? "unknown";

  return {
    owner,
    name,
    fullName: response.full_name ?? `${owner}/${name}`,
    defaultBranch: response.default_branch ?? "main",
    pushedAt: response.pushed_at ?? null
  };
}

function normalizeBranch(
  fork: ForkRef,
  response: GitHubBranchResponse
): BranchRef {
  return {
    repository: fork,
    name: response.name ?? "unknown",
    headSha: response.commit?.sha ?? ""
  };
}

function normalizeCommit(response: GitHubCommitResponse): CandidateCommit {
  return {
    sha: response.sha ?? "",
    message: response.commit?.message ?? "",
    authoredAt: response.commit?.author?.date ?? null,
    committedAt: response.commit?.committer?.date ?? null
  };
}

function normalizeChangedFile(
  response: GitHubChangedFileResponse
): ChangedFile {
  const patch = response.patch ?? null;

  return {
    path: response.filename ?? "unknown",
    status: response.status ?? "unknown",
    additions: response.additions ?? 0,
    deletions: response.deletions ?? 0,
    changes: response.changes ?? 0,
    isBinary: patch === null && (response.changes ?? 0) > 0,
    previousPath: response.previous_filename ?? null,
    patch
  };
}

function buildPathWithQuery(
  path: string,
  parameters: Readonly<Record<string, string>>
): string {
  const searchParameters = new URLSearchParams(parameters);
  const query = searchParameters.toString();

  if (query.length === 0) {
    return path;
  }

  return `${path}?${query}`;
}

function parseGitHubErrorMessage(rawBody: string): string {
  try {
    const parsed = JSON.parse(rawBody) as GitHubErrorBody;

    if (typeof parsed.message === "string" && parsed.message.length > 0) {
      return parsed.message;
    }
  } catch {
    if (rawBody.trim().length > 0) {
      return rawBody.trim();
    }
  }

  return "GitHub API request failed";
}

function classifyGitHubError(
  response: Response,
  message: string
): "api" | "auth" | "rate-limit" {
  const normalizedMessage = message.toLowerCase();
  const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");

  if (
    response.status === 429 ||
    (response.status === 403 &&
      (rateLimitRemaining === "0" ||
        normalizedMessage.includes("rate limit") ||
        normalizedMessage.includes("secondary rate limit")))
  ) {
    return "rate-limit";
  }

  if (response.status === 401 || response.status === 403) {
    return "auth";
  }

  return "api";
}

function parseRateLimitReset(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const epochSeconds = Number.parseInt(value, 10);

  if (!Number.isSafeInteger(epochSeconds) || epochSeconds <= 0) {
    return null;
  }

  return new Date(epochSeconds * 1000).toISOString();
}

function compareForks(left: ForkRef, right: ForkRef): number {
  return left.fullName.localeCompare(right.fullName);
}

function compareBranches(left: BranchRef, right: BranchRef): number {
  return (
    left.repository.fullName.localeCompare(right.repository.fullName) ||
    left.name.localeCompare(right.name)
  );
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

function buildCompareUrl(
  baseRepository: RepositoryRef,
  baseBranch: string,
  sourceBranch: BranchRef
): string {
  return `https://github.com/${baseRepository.fullName}/compare/${encodeURIComponent(
    baseBranch
  )}...${sourceBranch.repository.owner}:${encodeURIComponent(
    sourceBranch.name
  )}`;
}
