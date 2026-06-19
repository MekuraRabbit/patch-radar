import { createCandidateId } from "../domain/candidates.js";
import { extractIssueReferences } from "../domain/issueReferences.js";
import { classifyRiskSignals } from "../domain/riskSignals.js";
import { detectTestsChanged } from "../domain/testsChanged.js";
import type {
  BranchRef,
  DiffSummary,
  PatchCandidate,
  RepositoryRef
} from "../domain/types.js";
import type { GitHubReadClient } from "./types.js";

export async function summarizeBranchDiff(
  client: GitHubReadClient,
  baseRepository: RepositoryRef,
  baseBranch: string,
  sourceBranch: BranchRef
): Promise<PatchCandidate | null> {
  const comparison = await client.compareBranch(
    baseRepository,
    baseBranch,
    sourceBranch
  );

  if (comparison.aheadBy <= 0) {
    return null;
  }

  const diff: DiffSummary = {
    filesChanged: comparison.changedFiles.length,
    additions: sumBy(comparison.changedFiles, (file) => file.additions),
    deletions: sumBy(comparison.changedFiles, (file) => file.deletions),
    totalChanges: sumBy(comparison.changedFiles, (file) => file.changes),
    commits: comparison.totalCommits,
    aheadBy: comparison.aheadBy,
    behindBy: comparison.behindBy
  };
  const issueReferences = extractIssueReferences(
    [sourceBranch.name, ...comparison.commits.map((commit) => commit.message)],
    baseRepository
  );
  const testsChanged = detectTestsChanged(comparison.changedFiles);
  const riskSignals = classifyRiskSignals(comparison.changedFiles, diff);

  return {
    id: createCandidateId({
      baseRepository,
      sourceBranch
    }),
    sourceBranch,
    baseRepository,
    baseBranch,
    headSha: sourceBranch.headSha,
    compareUrl: comparison.compareUrl,
    updatedAt:
      getLatestCommitTimestamp(comparison.commits) ??
      sourceBranch.repository.pushedAt,
    commits: comparison.commits,
    changedFiles: comparison.changedFiles,
    diff,
    issueReferences,
    testsChanged,
    riskSignals
  };
}

function sumBy<T>(
  values: readonly T[],
  selector: (value: T) => number
): number {
  return values.reduce((total, value) => total + selector(value), 0);
}

function getLatestCommitTimestamp(
  commits: readonly { authoredAt: string | null; committedAt: string | null }[]
): string | null {
  const timestamps = commits
    .flatMap((commit) => [commit.committedAt, commit.authoredAt])
    .filter((value): value is string => value !== null)
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps)).toISOString();
}
