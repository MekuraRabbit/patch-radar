import type {
  PatchCandidate,
  RankedPatchCandidate,
  ScoreComponent
} from "../domain/types.js";

const RECENT_UPDATE_DAYS = 30;
const SOMEWHAT_RECENT_UPDATE_DAYS = 90;
const SMALL_DIFF_FILES = 10;
const SMALL_DIFF_CHANGES = 500;
const MEDIUM_DIFF_FILES = 25;
const MEDIUM_DIFF_CHANGES = 1000;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function rankPatchCandidates(
  candidates: readonly PatchCandidate[],
  now: Date
): RankedPatchCandidate[] {
  return candidates
    .map((candidate) => {
      const scoreComponents = scoreCandidate(candidate, now);
      const score = Math.max(
        0,
        scoreComponents.reduce(
          (total, component) => total + component.points,
          0
        )
      );

      return {
        ...candidate,
        score,
        scoreComponents
      };
    })
    .sort(compareRankedCandidates);
}

function scoreCandidate(
  candidate: PatchCandidate,
  now: Date
): ScoreComponent[] {
  const components: ScoreComponent[] = [];

  if (candidate.issueReferences.length > 0) {
    components.push({
      kind: "issue-reference",
      points: 20,
      evidence: `mentions ${candidate.issueReferences
        .map((reference) => `${reference.repository}#${reference.number}`)
        .join(", ")}`
    });
  }

  if (candidate.testsChanged) {
    components.push({
      kind: "tests-changed",
      points: 20,
      evidence: "changes test-looking files"
    });
  }

  const diffComponent = scoreDiffSize(candidate);
  if (diffComponent !== null) {
    components.push(diffComponent);
  }

  const updateComponent = scoreRecentUpdate(candidate, now);
  if (updateComponent !== null) {
    components.push(updateComponent);
  }

  if (candidate.riskSignals.length > 0) {
    components.push({
      kind: "risk-signal",
      points: -Math.min(20, candidate.riskSignals.length * 5),
      evidence: `${candidate.riskSignals.length} observable risk signal(s)`
    });
  }

  return components;
}

function scoreDiffSize(candidate: PatchCandidate): ScoreComponent | null {
  if (
    candidate.diff.filesChanged <= SMALL_DIFF_FILES &&
    candidate.diff.totalChanges <= SMALL_DIFF_CHANGES
  ) {
    return {
      kind: "diff-size",
      points: 10,
      evidence: `${candidate.diff.filesChanged} files, ${candidate.diff.totalChanges} changed lines`
    };
  }

  if (
    candidate.diff.filesChanged <= MEDIUM_DIFF_FILES &&
    candidate.diff.totalChanges <= MEDIUM_DIFF_CHANGES
  ) {
    return {
      kind: "diff-size",
      points: 5,
      evidence: `${candidate.diff.filesChanged} files, ${candidate.diff.totalChanges} changed lines`
    };
  }

  return null;
}

function scoreRecentUpdate(
  candidate: PatchCandidate,
  now: Date
): ScoreComponent | null {
  if (candidate.updatedAt === null) {
    return null;
  }

  const updatedAt = Date.parse(candidate.updatedAt);

  if (!Number.isFinite(updatedAt)) {
    return null;
  }

  const ageDays = Math.max(
    0,
    Math.floor((now.getTime() - updatedAt) / MILLISECONDS_PER_DAY)
  );

  if (ageDays <= RECENT_UPDATE_DAYS) {
    return {
      kind: "recent-update",
      points: 10,
      evidence: `updated ${ageDays} day(s) ago`
    };
  }

  if (ageDays <= SOMEWHAT_RECENT_UPDATE_DAYS) {
    return {
      kind: "recent-update",
      points: 5,
      evidence: `updated ${ageDays} day(s) ago`
    };
  }

  return null;
}

function compareRankedCandidates(
  left: RankedPatchCandidate,
  right: RankedPatchCandidate
): number {
  return (
    right.score - left.score ||
    getTimestamp(right.updatedAt) - getTimestamp(left.updatedAt) ||
    left.id.localeCompare(right.id)
  );
}

function getTimestamp(value: string | null): number {
  if (value === null) {
    return 0;
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return 0;
  }

  return timestamp;
}
