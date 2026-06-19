import { describe, expect, it } from "vitest";

import { createCandidateId } from "../src/domain/candidates.js";
import { extractIssueReferences } from "../src/domain/issueReferences.js";
import { parseRepositoryRef } from "../src/domain/repository.js";
import { classifyRiskSignals } from "../src/domain/riskSignals.js";
import { detectTestsChanged } from "../src/domain/testsChanged.js";
import type { ChangedFile, DiffSummary } from "../src/domain/types.js";

describe("parseRepositoryRef", () => {
  it("parses owner/repo references", () => {
    expect(parseRepositoryRef("owner/repo")).toEqual({
      owner: "owner",
      name: "repo",
      fullName: "owner/repo"
    });
  });

  it("rejects invalid repository refs", () => {
    expect(() => parseRepositoryRef("https://github.com/owner/repo")).toThrow(
      "Invalid repository ref"
    );
    expect(() => parseRepositoryRef("owner")).toThrow("Invalid repository ref");
  });
});

describe("extractIssueReferences", () => {
  it("extracts unique issue references from branches and commit messages", () => {
    const repository = parseRepositoryRef("owner/repo");

    expect(
      extractIssueReferences(
        [
          "fix-#347",
          "Refs GH-348 and owner/repo#349",
          "See https://github.com/other/project/issues/12"
        ],
        repository
      )
    ).toEqual([
      {
        repository: "other/project",
        number: 12,
        raw: "github.com/other/project/issues/12"
      },
      {
        repository: "owner/repo",
        number: 347,
        raw: "#347"
      },
      {
        repository: "owner/repo",
        number: 348,
        raw: "GH-348"
      },
      {
        repository: "owner/repo",
        number: 349,
        raw: "owner/repo#349"
      }
    ]);
  });
});

describe("classifyRiskSignals", () => {
  it("classifies observable file and diff risk signals", () => {
    const files: ChangedFile[] = [
      changedFile("package.json", {
        patch: '+    "postinstall": "node setup.js"'
      }),
      changedFile("package-lock.json"),
      changedFile(".github/workflows/ci.yml"),
      changedFile("src/auth/session.ts"),
      changedFile("src/crypto/cipher.ts"),
      changedFile("dist/client.generated.min.js"),
      changedFile("assets/logo.png", { patch: null, isBinary: true })
    ];
    const diff: DiffSummary = {
      filesChanged: 51,
      additions: 900,
      deletions: 200,
      totalChanges: 1100,
      commits: 3,
      aheadBy: 3,
      behindBy: 0
    };

    expect(
      classifyRiskSignals(files, diff).map((signal) => signal.kind)
    ).toEqual([
      "dependency-file",
      "lockfile",
      "ci-file",
      "install-script",
      "auth-file",
      "crypto-file",
      "security-sensitive-file",
      "generated-file",
      "binary-file",
      "large-diff"
    ]);
  });
});

describe("detectTestsChanged", () => {
  it("detects common test file paths", () => {
    expect(detectTestsChanged([changedFile("src/foo.test.ts")])).toBe(true);
    expect(detectTestsChanged([changedFile("src/foo.ts")])).toBe(false);
  });
});

describe("createCandidateId", () => {
  it("is stable for the same base repository, source branch, and head sha", () => {
    const baseRepository = parseRepositoryRef("owner/repo");
    const sourceBranch = {
      repository: {
        owner: "alice",
        name: "repo",
        fullName: "alice/repo",
        defaultBranch: "main",
        pushedAt: "2026-06-01T00:00:00.000Z"
      },
      name: "fix-347",
      headSha: "abc123"
    };

    expect(createCandidateId({ baseRepository, sourceBranch })).toBe(
      createCandidateId({ baseRepository, sourceBranch })
    );
  });
});

function changedFile(
  path: string,
  overrides: Partial<ChangedFile> = {}
): ChangedFile {
  return {
    path,
    status: "modified",
    additions: 1,
    deletions: 0,
    changes: 1,
    isBinary: false,
    previousPath: null,
    patch: "",
    ...overrides
  };
}
