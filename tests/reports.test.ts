import { describe, expect, it } from "vitest";

import { SCAN_SCHEMA_VERSION } from "../src/domain/types.js";
import type { ScanReport } from "../src/domain/types.js";
import { renderHumanReport } from "../src/reports/human.js";
import { renderJsonReport } from "../src/reports/json.js";

describe("renderJsonReport", () => {
  it("renders the documented stable v0.1 JSON shape", () => {
    const parsed = JSON.parse(renderJsonReport(sampleReport())) as Record<
      string,
      unknown
    >;
    const candidates = parsed.candidates as Record<string, unknown>[];
    const firstCandidate = candidates[0];
    const changedFiles = firstCandidate?.changedFiles as
      | Record<string, unknown>[]
      | undefined;

    expect(Object.keys(parsed)).toEqual([
      "schemaVersion",
      "repository",
      "baseBranch",
      "generatedAt",
      "limits",
      "candidates",
      "warnings"
    ]);
    expect(parsed.schemaVersion).toBe("patch-radar.scan.v0.1");
    expect(
      firstCandidate === undefined ? [] : Object.keys(firstCandidate)
    ).toEqual([
      "id",
      "source",
      "base",
      "compareUrl",
      "updatedAt",
      "score",
      "scoreComponents",
      "diff",
      "changedFiles",
      "issueReferences",
      "testsChanged",
      "riskSignals"
    ]);
    expect(changedFiles?.[0]).toEqual({
      path: "src/fix.ts",
      status: "modified",
      additions: 10,
      deletions: 2,
      changes: 12,
      isBinary: false,
      previousPath: null
    });
  });
});

describe("renderHumanReport", () => {
  it("renders concise read-only human output", () => {
    expect(renderHumanReport(sampleReport())).toContain(
      "Read-only: no PRs, no comments, no remote writes, no fork code execution."
    );
  });
});

function sampleReport(): ScanReport {
  return {
    schemaVersion: SCAN_SCHEMA_VERSION,
    repository: {
      owner: "owner",
      name: "repo",
      fullName: "owner/repo"
    },
    baseBranch: "main",
    generatedAt: "2026-06-18T00:00:00.000Z",
    limits: {
      maxForks: 20,
      maxBranchesPerFork: 10,
      concurrency: 4,
      timeoutMs: 10000
    },
    candidates: [
      {
        id: "cand_123",
        sourceBranch: {
          repository: {
            owner: "alice",
            name: "repo",
            fullName: "alice/repo",
            defaultBranch: "main",
            pushedAt: "2026-06-17T00:00:00.000Z"
          },
          name: "fix-347",
          headSha: "abc123"
        },
        baseRepository: {
          owner: "owner",
          name: "repo",
          fullName: "owner/repo"
        },
        baseBranch: "main",
        headSha: "abc123",
        compareUrl:
          "https://github.com/owner/repo/compare/main...alice:fix-347",
        updatedAt: "2026-06-17T00:00:00.000Z",
        commits: [
          {
            sha: "abc123",
            message: "Fix #347",
            authoredAt: "2026-06-17T00:00:00.000Z",
            committedAt: "2026-06-17T00:00:00.000Z"
          }
        ],
        changedFiles: [
          {
            path: "src/fix.ts",
            status: "modified",
            additions: 10,
            deletions: 2,
            changes: 12,
            isBinary: false,
            previousPath: null,
            patch: "diff text is internal and must not be rendered"
          }
        ],
        diff: {
          filesChanged: 1,
          additions: 10,
          deletions: 2,
          totalChanges: 12,
          commits: 1,
          aheadBy: 1,
          behindBy: 0
        },
        issueReferences: [
          {
            repository: "owner/repo",
            number: 347,
            raw: "#347"
          }
        ],
        testsChanged: false,
        riskSignals: [],
        score: 40,
        scoreComponents: [
          {
            kind: "issue-reference",
            points: 20,
            evidence: "mentions owner/repo#347"
          }
        ]
      }
    ],
    warnings: []
  };
}
