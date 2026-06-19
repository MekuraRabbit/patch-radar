import { createHash } from "node:crypto";

import type { BranchRef, RepositoryRef } from "./types.js";

export function createCandidateId(input: {
  baseRepository: RepositoryRef;
  sourceBranch: BranchRef;
}): string {
  const stableSource = [
    input.baseRepository.fullName,
    input.sourceBranch.repository.fullName,
    input.sourceBranch.name,
    input.sourceBranch.headSha
  ].join("|");
  const digest = createHash("sha256").update(stableSource).digest("hex");

  return `cand_${digest.slice(0, 16)}`;
}
