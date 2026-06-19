import { describe, expect, it } from "vitest";

import { parseCliArguments } from "../src/cli/arguments.js";
import { runCli } from "../src/cli/runCli.js";
import { GitHubApiError } from "../src/github/errors.js";
import type { GitHubReadClient } from "../src/github/types.js";

describe("parseCliArguments", () => {
  it("parses scan resource controls", () => {
    expect(
      parseCliArguments([
        "scan",
        "owner/repo",
        "--json",
        "--max-forks",
        "5",
        "--max-branches-per-fork",
        "3",
        "--concurrency",
        "2",
        "--timeout-ms",
        "5000"
      ])
    ).toMatchObject({
      kind: "scan",
      options: {
        json: true,
        limits: {
          maxForks: 5,
          maxBranchesPerFork: 3,
          concurrency: 2,
          timeoutMs: 5000
        }
      }
    });
  });

  it("rejects invalid resource controls", () => {
    expect(() =>
      parseCliArguments(["scan", "owner/repo", "--concurrency", "0"])
    ).toThrow("--concurrency must be between 1 and 10.");
  });
});

describe("runCli", () => {
  it("returns exit code 0 for scan help", async () => {
    const output = createOutput();

    await expect(
      runCli(["scan", "--help"], {
        env: {},
        stdout: output.stdout,
        stderr: output.stderr,
        createClient: () => emptyClient()
      })
    ).resolves.toBe(0);
    expect(output.stdoutText()).toContain("--max-forks");
    expect(output.stderrText()).toBe("");
  });

  it("returns exit code 1 for invalid repository refs", async () => {
    const output = createOutput();

    await expect(
      runCli(["scan", "not-a-ref"], {
        env: {},
        stdout: output.stdout,
        stderr: output.stderr,
        createClient: () => emptyClient()
      })
    ).resolves.toBe(1);
    expect(output.stderrText()).toContain("Invalid repository ref");
  });

  it("returns exit code 0 when no candidates are found", async () => {
    const output = createOutput();

    await expect(
      runCli(["scan", "owner/repo"], {
        env: {},
        stdout: output.stdout,
        stderr: output.stderr,
        now: new Date("2026-06-18T00:00:00.000Z"),
        createClient: () => emptyClient()
      })
    ).resolves.toBe(0);
    expect(output.stdoutText()).toContain("No candidate patch branches found.");
  });

  it("returns exit code 2 for GitHub failures", async () => {
    const output = createOutput();

    await expect(
      runCli(["scan", "owner/repo"], {
        env: {},
        stdout: output.stdout,
        stderr: output.stderr,
        createClient: () => failingClient()
      })
    ).resolves.toBe(2);
    expect(output.stderrText()).toContain("GitHub API rate limit exceeded");
  });

  it("passes GH_TOKEN to the GitHub client factory without printing it", async () => {
    const output = createOutput();
    const seenTokens: (string | null)[] = [];

    await runCli(["scan", "owner/repo", "--json"], {
      env: {
        GH_TOKEN: "secret-token"
      },
      stdout: output.stdout,
      stderr: output.stderr,
      now: new Date("2026-06-18T00:00:00.000Z"),
      createClient: (options) => {
        seenTokens.push(options.token);
        return emptyClient();
      }
    });

    expect(seenTokens).toEqual(["secret-token"]);
    expect(output.stdoutText()).not.toContain("secret-token");
    expect(output.stderrText()).not.toContain("secret-token");
  });
});

function createOutput(): {
  stdout: { write(chunk: string): void };
  stderr: { write(chunk: string): void };
  stdoutText(): string;
  stderrText(): string;
} {
  let stdout = "";
  let stderr = "";

  return {
    stdout: {
      write(chunk: string): void {
        stdout += chunk;
      }
    },
    stderr: {
      write(chunk: string): void {
        stderr += chunk;
      }
    },
    stdoutText(): string {
      return stdout;
    },
    stderrText(): string {
      return stderr;
    }
  };
}

function emptyClient(): GitHubReadClient {
  return {
    fetchRepository() {
      return Promise.resolve({
        defaultBranch: "main"
      });
    },
    listForks() {
      return Promise.resolve([]);
    },
    listBranches() {
      return Promise.resolve([]);
    },
    compareBranch() {
      return Promise.reject(new Error("compareBranch should not be called"));
    }
  };
}

function failingClient(): GitHubReadClient {
  return {
    fetchRepository() {
      return Promise.reject(
        new GitHubApiError("GitHub API rate limit exceeded", {
          status: 403,
          code: "rate-limit",
          retryAfter: null,
          rateLimitReset: "2026-06-18T12:34:00.000Z"
        })
      );
    },
    listForks() {
      return Promise.resolve([]);
    },
    listBranches() {
      return Promise.resolve([]);
    },
    compareBranch() {
      return Promise.reject(new Error("compareBranch should not be called"));
    }
  };
}
