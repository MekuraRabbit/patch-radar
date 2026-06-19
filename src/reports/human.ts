import type { RankedPatchCandidate, ScanReport } from "../domain/types.js";

export function renderHumanReport(report: ScanReport): string {
  const lines = [
    `Patch Radar scan: ${report.repository.fullName}`,
    `Base branch: ${report.baseBranch}`,
    `Candidates: ${report.candidates.length}`,
    `Limits: max forks ${report.limits.maxForks}, max branches per fork ${report.limits.maxBranchesPerFork}, concurrency ${report.limits.concurrency}, timeout ${report.limits.timeoutMs}ms`,
    "Read-only: no PRs, no comments, no remote writes, no fork code execution.",
    ""
  ];

  if (report.candidates.length === 0) {
    lines.push("No candidate patch branches found.");
  } else {
    report.candidates.forEach((candidate, index) => {
      lines.push(renderCandidate(candidate, index + 1));
    });
  }

  if (report.warnings.length > 0) {
    lines.push("", "Warnings:");
    for (const warning of report.warnings) {
      const source =
        warning.source === null || warning.source.length === 0
          ? ""
          : ` (${warning.source})`;
      lines.push(`- ${warning.message}${source}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function renderCandidate(
  candidate: RankedPatchCandidate,
  candidateNumber: number
): string {
  const issueReferences =
    candidate.issueReferences.length === 0
      ? "none"
      : candidate.issueReferences
          .map((reference) => `${reference.repository}#${reference.number}`)
          .join(", ");
  const riskSignals =
    candidate.riskSignals.length === 0
      ? "none"
      : candidate.riskSignals
          .map((signal) => `${signal.kind}: ${signal.evidence}`)
          .join("; ");

  return [
    `${candidateNumber}. ${candidate.id}`,
    `   Source: ${candidate.sourceBranch.repository.fullName}:${candidate.sourceBranch.name}`,
    `   Score: ${candidate.score}`,
    `   Updated: ${candidate.updatedAt ?? "unknown"}`,
    `   Diff: ${candidate.diff.filesChanged} files, +${candidate.diff.additions} -${candidate.diff.deletions}, ${candidate.diff.commits} commits ahead`,
    `   Issues: ${issueReferences}`,
    `   Tests changed: ${candidate.testsChanged ? "yes" : "no"}`,
    `   Risk signals: ${riskSignals}`,
    `   Compare: ${candidate.compareUrl}`,
    ""
  ].join("\n");
}
