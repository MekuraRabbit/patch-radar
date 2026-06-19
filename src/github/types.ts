import type {
  BranchRef,
  CandidateCommit,
  ChangedFile,
  ForkRef,
  RepositoryRef
} from "../domain/types.js";

export interface GitHubRepository {
  defaultBranch: string;
}

export interface BranchComparison {
  compareUrl: string;
  aheadBy: number;
  behindBy: number;
  totalCommits: number;
  commits: CandidateCommit[];
  changedFiles: ChangedFile[];
}

export interface GitHubReadClient {
  fetchRepository(repository: RepositoryRef): Promise<GitHubRepository>;
  listForks(repository: RepositoryRef, maxForks: number): Promise<ForkRef[]>;
  listBranches(fork: ForkRef, maxBranches: number): Promise<BranchRef[]>;
  compareBranch(
    baseRepository: RepositoryRef,
    baseBranch: string,
    sourceBranch: BranchRef
  ): Promise<BranchComparison>;
}

export interface DiscoveredForkBranches {
  baseBranch: string;
  branches: BranchRef[];
}
