import { describe, expect, it } from "vitest";

import { parseRepositoryRef } from "../src/domain/repository.js";
import { GitHubClient } from "../src/github/apiClient.js";
import { GitHubApiError } from "../src/github/errors.js";

describe("GitHubClient", () => {
  it("paginates fork requests up to the requested maximum", async () => {
    const requestedUrls: string[] = [];
    const client = new GitHubClient({
      token: "secret-token",
      timeoutMs: 1000,
      apiBaseUrl: "https://api.test",
      fetchFn: (input) => {
        requestedUrls.push(String(input));

        return Promise.resolve(
          jsonResponse([
            {
              owner: { login: "bob" },
              name: "repo",
              full_name: "bob/repo",
              default_branch: "main",
              pushed_at: "2026-06-01T00:00:00.000Z"
            },
            {
              owner: { login: "alice" },
              name: "repo",
              full_name: "alice/repo",
              default_branch: "main",
              pushed_at: "2026-06-02T00:00:00.000Z"
            }
          ])
        );
      }
    });

    await expect(
      client.listForks(parseRepositoryRef("owner/repo"), 2)
    ).resolves.toEqual([
      {
        owner: "alice",
        name: "repo",
        fullName: "alice/repo",
        defaultBranch: "main",
        pushedAt: "2026-06-02T00:00:00.000Z"
      },
      {
        owner: "bob",
        name: "repo",
        fullName: "bob/repo",
        defaultBranch: "main",
        pushedAt: "2026-06-01T00:00:00.000Z"
      }
    ]);
    expect(requestedUrls).toEqual([
      "https://api.test/repos/owner/repo/forks?sort=updated&page=1&per_page=2"
    ]);
  });

  it("maps rate limit responses to GitHubApiError without leaking tokens", async () => {
    const client = new GitHubClient({
      token: "secret-token",
      timeoutMs: 1000,
      apiBaseUrl: "https://api.test",
      fetchFn: () =>
        Promise.resolve(
          jsonResponse(
            {
              message: "API rate limit exceeded for secret-token"
            },
            {
              status: 403,
              headers: {
                "x-ratelimit-remaining": "0",
                "x-ratelimit-reset": "1781726400"
              }
            }
          )
        )
    });

    try {
      await client.fetchRepository(parseRepositoryRef("owner/repo"));
      throw new Error("Expected GitHubApiError");
    } catch (error) {
      expect(error).toBeInstanceOf(GitHubApiError);

      if (!(error instanceof GitHubApiError)) {
        throw error;
      }

      expect(error.code).toBe("rate-limit");
      expect(error.status).toBe(403);
      expect(error.message).not.toContain("secret-token");
    }
  });
});

function jsonResponse(
  body: unknown,
  init: {
    status?: number;
    headers?: Record<string, string>;
  } = {}
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...init.headers
    }
  });
}
