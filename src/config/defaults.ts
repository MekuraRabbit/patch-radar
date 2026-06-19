import type { ScanLimits } from "../domain/types.js";

export const DEFAULT_SCAN_LIMITS: ScanLimits = {
  maxForks: 20,
  maxBranchesPerFork: 10,
  concurrency: 4,
  timeoutMs: 10_000
};

export const MAX_SCAN_LIMITS: ScanLimits = {
  maxForks: 100,
  maxBranchesPerFork: 100,
  concurrency: 10,
  timeoutMs: 120_000
};

export const MIN_TIMEOUT_MS = 100;
