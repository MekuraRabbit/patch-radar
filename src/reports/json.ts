import type { ScanReport } from "../domain/types.js";

export function renderJsonReport(report: ScanReport): string {
  const stableReport = {
    schemaVersion: report.schemaVersion,
    repository: {
      owner: report.repository.owner,
      name: report.repository.name,
      fullName: report.repository.fullName
    },
    baseBranch: report.baseBranch,
    generatedAt: report.generatedAt,
    limits: {
      maxForks: report.limits.maxForks,
      maxBranchesPerFork: report.limits.maxBranchesPerFork,
      concurrency: report.limits.concurrency,
      timeoutMs: report.limits.timeoutMs
    },
    candidates: report.candidates.map((candidate) => ({
      id: candidate.id,
      source: {
        repository: {
          owner: candidate.sourceBranch.repository.owner,
          name: candidate.sourceBranch.repository.name,
          fullName: candidate.sourceBranch.repository.fullName
        },
        branch: candidate.sourceBranch.name,
        headSha: candidate.headSha
      },
      base: {
        repository: {
          owner: candidate.baseRepository.owner,
          name: candidate.baseRepository.name,
          fullName: candidate.baseRepository.fullName
        },
        branch: candidate.baseBranch
      },
      compareUrl: candidate.compareUrl,
      updatedAt: candidate.updatedAt,
      score: candidate.score,
      scoreComponents: candidate.scoreComponents.map((component) => ({
        kind: component.kind,
        points: component.points,
        evidence: component.evidence
      })),
      diff: {
        filesChanged: candidate.diff.filesChanged,
        additions: candidate.diff.additions,
        deletions: candidate.diff.deletions,
        totalChanges: candidate.diff.totalChanges,
        commits: candidate.diff.commits,
        aheadBy: candidate.diff.aheadBy,
        behindBy: candidate.diff.behindBy
      },
      changedFiles: candidate.changedFiles.map((file) => ({
        path: file.path,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        isBinary: file.isBinary,
        previousPath: file.previousPath
      })),
      issueReferences: candidate.issueReferences.map((reference) => ({
        repository: reference.repository,
        number: reference.number,
        raw: reference.raw
      })),
      testsChanged: candidate.testsChanged,
      riskSignals: candidate.riskSignals.map((signal) => ({
        kind: signal.kind,
        severity: signal.severity,
        evidence: signal.evidence
      }))
    })),
    warnings: report.warnings.map((warning) => ({
      message: warning.message,
      source: warning.source
    }))
  };

  return `${JSON.stringify(stableReport, null, 2)}\n`;
}
