import type { ScanLimits } from "../domain/types.js";
import { mapWithConcurrency } from "../utils/concurrency.js";
import type { DiscoveredForkBranches, GitHubReadClient } from "./types.js";
import type { RepositoryRef, BranchRef } from "../domain/types.js";

export async function collectForkBranches(
  client: GitHubReadClient,
  repository: RepositoryRef,
  limits: ScanLimits
): Promise<DiscoveredForkBranches> {
  const upstream = await client.fetchRepository(repository);
  const forks = await client.listForks(repository, limits.maxForks);
  const branchGroups = await mapWithConcurrency(
    forks,
    limits.concurrency,
    async (fork) => client.listBranches(fork, limits.maxBranchesPerFork)
  );
  const branches = branchGroups.flat().sort(compareBranchRefs);

  return {
    baseBranch: upstream.defaultBranch,
    branches
  };
}

function compareBranchRefs(left: BranchRef, right: BranchRef): number {
  return (
    left.repository.fullName.localeCompare(right.repository.fullName) ||
    left.name.localeCompare(right.name) ||
    left.headSha.localeCompare(right.headSha)
  );
}
