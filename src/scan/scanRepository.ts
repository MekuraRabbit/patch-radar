import { SCAN_SCHEMA_VERSION } from "../domain/types.js";
import type {
  PatchCandidate,
  RepositoryRef,
  ScanLimits,
  ScanReport
} from "../domain/types.js";
import { collectForkBranches } from "../github/collectForkBranches.js";
import { summarizeBranchDiff } from "../github/summarizeBranchDiff.js";
import type { GitHubReadClient } from "../github/types.js";
import { rankPatchCandidates } from "../ranking/rankPatchCandidates.js";
import { mapWithConcurrency } from "../utils/concurrency.js";

export async function scanRepository(
  client: GitHubReadClient,
  repository: RepositoryRef,
  limits: ScanLimits,
  now: Date
): Promise<ScanReport> {
  const discovery = await collectForkBranches(client, repository, limits);
  const candidateResults = await mapWithConcurrency(
    discovery.branches,
    limits.concurrency,
    async (branch) =>
      summarizeBranchDiff(client, repository, discovery.baseBranch, branch)
  );
  const candidates = candidateResults.filter(
    (candidate): candidate is PatchCandidate => candidate !== null
  );

  return {
    schemaVersion: SCAN_SCHEMA_VERSION,
    repository,
    baseBranch: discovery.baseBranch,
    generatedAt: now.toISOString(),
    limits,
    candidates: rankPatchCandidates(candidates, now),
    warnings: []
  };
}
