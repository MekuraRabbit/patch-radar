export const SCAN_SCHEMA_VERSION = "patch-radar.scan.v0.1";

export interface RepositoryRef {
  owner: string;
  name: string;
  fullName: string;
}

export interface ScanLimits {
  maxForks: number;
  maxBranchesPerFork: number;
  concurrency: number;
  timeoutMs: number;
}

export interface ForkRef {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  pushedAt: string | null;
}

export interface BranchRef {
  repository: ForkRef;
  name: string;
  headSha: string;
}

export interface ChangedFile {
  path: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  isBinary: boolean;
  previousPath: string | null;
  patch: string | null;
}

export interface DiffSummary {
  filesChanged: number;
  additions: number;
  deletions: number;
  totalChanges: number;
  commits: number;
  aheadBy: number;
  behindBy: number;
}

export interface CandidateCommit {
  sha: string;
  message: string;
  authoredAt: string | null;
  committedAt: string | null;
}

export interface IssueReference {
  repository: string;
  number: number;
  raw: string;
}

export type RiskSignalKind =
  | "dependency-file"
  | "lockfile"
  | "ci-file"
  | "install-script"
  | "auth-file"
  | "crypto-file"
  | "security-sensitive-file"
  | "generated-file"
  | "binary-file"
  | "large-diff";

export interface RiskSignal {
  kind: RiskSignalKind;
  severity: "review";
  evidence: string;
}

export interface ScoreComponent {
  kind:
    | "issue-reference"
    | "tests-changed"
    | "diff-size"
    | "recent-update"
    | "risk-signal";
  points: number;
  evidence: string;
}

export interface PatchCandidate {
  id: string;
  sourceBranch: BranchRef;
  baseRepository: RepositoryRef;
  baseBranch: string;
  headSha: string;
  compareUrl: string;
  updatedAt: string | null;
  commits: CandidateCommit[];
  changedFiles: ChangedFile[];
  diff: DiffSummary;
  issueReferences: IssueReference[];
  testsChanged: boolean;
  riskSignals: RiskSignal[];
}

export interface RankedPatchCandidate extends PatchCandidate {
  score: number;
  scoreComponents: ScoreComponent[];
}

export interface ScanWarning {
  message: string;
  source: string | null;
}

export interface ScanReport {
  schemaVersion: typeof SCAN_SCHEMA_VERSION;
  repository: RepositoryRef;
  baseBranch: string;
  generatedAt: string;
  limits: ScanLimits;
  candidates: RankedPatchCandidate[];
  warnings: ScanWarning[];
}
