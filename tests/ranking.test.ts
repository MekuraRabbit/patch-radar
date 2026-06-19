import { describe, expect, it } from "vitest";

import { parseRepositoryRef } from "../src/domain/repository.js";
import type { PatchCandidate } from "../src/domain/types.js";
import { rankPatchCandidates } from "../src/ranking/rankPatchCandidates.js";

describe("rankPatchCandidates", () => {
  it("scores patch evidence without using fork owner trust signals", () => {
    const ranked = rankPatchCandidates(
      [
        candidate({
          id: "cand_low",
          forkOwner: "well-known-owner",
          testsChanged: false,
          issueReferences: [],
          updatedAt: "2025-01-01T00:00:00.000Z",
          filesChanged: 60,
          totalChanges: 2000,
          riskSignals: [
            {
              kind: "large-diff",
              severity: "review",
              evidence: "60 files, 2000 changed lines"
            }
          ]
        }),
        candidate({
          id: "cand_high",
          forkOwner: "unknown-owner",
          testsChanged: true,
          issueReferences: [
            {
              repository: "owner/repo",
              number: 347,
              raw: "#347"
            }
          ],
          updatedAt: "2026-06-10T00:00:00.000Z",
          filesChanged: 3,
          totalChanges: 80,
          riskSignals: []
        })
      ],
      new Date("2026-06-18T00:00:00.000Z")
    );

    expect(ranked[0]?.id).toBe("cand_high");
    expect(
      ranked[0]?.scoreComponents.map((component) => component.kind)
    ).toEqual([
      "issue-reference",
      "tests-changed",
      "diff-size",
      "recent-update"
    ]);
  });
});

function candidate(options: {
  id: string;
  forkOwner: string;
  testsChanged: boolean;
  issueReferences: PatchCandidate["issueReferences"];
  updatedAt: string;
  filesChanged: number;
  totalChanges: number;
  riskSignals: PatchCandidate["riskSignals"];
}): PatchCandidate {
  const baseRepository = parseRepositoryRef("owner/repo");

  return {
    id: options.id,
    sourceBranch: {
      repository: {
        owner: options.forkOwner,
        name: "repo",
        fullName: `${options.forkOwner}/repo`,
        defaultBranch: "main",
        pushedAt: options.updatedAt
      },
      name: "patch",
      headSha: options.id
    },
    baseRepository,
    baseBranch: "main",
    headSha: options.id,
    compareUrl: `https://github.com/owner/repo/compare/main...${options.forkOwner}:patch`,
    updatedAt: options.updatedAt,
    commits: [],
    changedFiles: [],
    diff: {
      filesChanged: options.filesChanged,
      additions: options.totalChanges,
      deletions: 0,
      totalChanges: options.totalChanges,
      commits: 1,
      aheadBy: 1,
      behindBy: 0
    },
    issueReferences: options.issueReferences,
    testsChanged: options.testsChanged,
    riskSignals: options.riskSignals
  };
}
