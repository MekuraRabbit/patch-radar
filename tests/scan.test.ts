import { describe, expect, it } from "vitest";

import { parseRepositoryRef } from "../src/domain/repository.js";
import type { BranchRef, ForkRef, RepositoryRef } from "../src/domain/types.js";
import type {
  BranchComparison,
  GitHubReadClient,
  GitHubRepository
} from "../src/github/types.js";
import { scanRepository } from "../src/scan/scanRepository.js";

describe("scanRepository", () => {
  it("collects candidates with deterministic ordering and no fork execution", async () => {
    const client = new FakeGitHubClient();
    const report = await scanRepository(
      client,
      parseRepositoryRef("owner/repo"),
      {
        maxForks: 2,
        maxBranchesPerFork: 2,
        concurrency: 2,
        timeoutMs: 1000
      },
      new Date("2026-06-18T00:00:00.000Z")
    );

    expect(client.calls).toEqual([
      "fetchRepository:owner/repo",
      "listForks:owner/repo:2",
      "listBranches:alice/repo:2",
      "listBranches:bob/repo:2",
      "compare:alice/repo:fix-347",
      "compare:alice/repo:wip",
      "compare:bob/repo:docs"
    ]);
    expect(
      report.candidates.map((candidate) => candidate.sourceBranch.name)
    ).toEqual(["fix-347", "docs"]);
    expect(report.candidates[0]?.issueReferences).toEqual([
      {
        repository: "owner/repo",
        number: 347,
        raw: "#347"
      }
    ]);
    expect(report.candidates[0]?.testsChanged).toBe(true);
  });
});

class FakeGitHubClient implements GitHubReadClient {
  public readonly calls: string[] = [];

  public fetchRepository(repository: RepositoryRef): Promise<GitHubRepository> {
    this.calls.push(`fetchRepository:${repository.fullName}`);

    return Promise.resolve({
      defaultBranch: "main"
    });
  }

  public listForks(
    repository: RepositoryRef,
    maxForks: number
  ): Promise<ForkRef[]> {
    this.calls.push(`listForks:${repository.fullName}:${maxForks}`);

    return Promise.resolve(
      [
        fork("bob/repo", "2026-06-10T00:00:00.000Z"),
        fork("alice/repo", "2026-06-17T00:00:00.000Z")
      ].sort((left, right) => left.fullName.localeCompare(right.fullName))
    );
  }

  public listBranches(
    forkRef: ForkRef,
    maxBranches: number
  ): Promise<BranchRef[]> {
    this.calls.push(`listBranches:${forkRef.fullName}:${maxBranches}`);

    const branchesByFork: Record<string, BranchRef[]> = {
      "alice/repo": [
        branch(forkRef, "wip", "sha-wip"),
        branch(forkRef, "fix-347", "sha-fix")
      ],
      "bob/repo": [branch(forkRef, "docs", "sha-docs")]
    };

    return Promise.resolve(
      (branchesByFork[forkRef.fullName] ?? []).sort((left, right) =>
        left.name.localeCompare(right.name)
      )
    );
  }

  public compareBranch(
    _baseRepository: RepositoryRef,
    _baseBranch: string,
    sourceBranch: BranchRef
  ): Promise<BranchComparison> {
    this.calls.push(
      `compare:${sourceBranch.repository.fullName}:${sourceBranch.name}`
    );

    if (sourceBranch.name === "wip") {
      return Promise.resolve(
        comparison(sourceBranch, {
          aheadBy: 0,
          files: []
        })
      );
    }

    if (sourceBranch.name === "fix-347") {
      return Promise.resolve(
        comparison(sourceBranch, {
          aheadBy: 2,
          message: "Fix #347",
          files: [
            {
              path: "src/fix.ts",
              status: "modified",
              additions: 10,
              deletions: 1,
              changes: 11,
              isBinary: false,
              previousPath: null,
              patch: "@@"
            },
            {
              path: "tests/fix.test.ts",
              status: "added",
              additions: 20,
              deletions: 0,
              changes: 20,
              isBinary: false,
              previousPath: null,
              patch: "@@"
            }
          ]
        })
      );
    }

    return Promise.resolve(
      comparison(sourceBranch, {
        aheadBy: 1,
        message: "Update docs",
        files: [
          {
            path: "README.md",
            status: "modified",
            additions: 3,
            deletions: 1,
            changes: 4,
            isBinary: false,
            previousPath: null,
            patch: "@@"
          }
        ]
      })
    );
  }
}

function fork(fullName: string, pushedAt: string): ForkRef {
  const [owner, name] = fullName.split("/");

  return {
    owner: owner ?? "",
    name: name ?? "",
    fullName,
    defaultBranch: "main",
    pushedAt
  };
}

function branch(forkRef: ForkRef, name: string, headSha: string): BranchRef {
  return {
    repository: forkRef,
    name,
    headSha
  };
}

function comparison(
  sourceBranch: BranchRef,
  options: {
    aheadBy: number;
    message?: string;
    files: BranchComparison["changedFiles"];
  }
): BranchComparison {
  return {
    compareUrl: `https://github.com/owner/repo/compare/main...${sourceBranch.repository.owner}:${sourceBranch.name}`,
    aheadBy: options.aheadBy,
    behindBy: 0,
    totalCommits: options.aheadBy,
    commits:
      options.aheadBy === 0
        ? []
        : [
            {
              sha: sourceBranch.headSha,
              message: options.message ?? "",
              authoredAt: "2026-06-17T00:00:00.000Z",
              committedAt: "2026-06-17T00:00:00.000Z"
            }
          ],
    changedFiles: options.files
  };
}
