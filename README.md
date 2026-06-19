# Patch Radar

Patch Radar is a maintainer-first CLI for discovering useful patch work that already exists outside the main repository, especially in forks and branches.

The v0.1 MVP is deliberately read-only. It discovers candidate branches, summarizes evidence, and leaves all decisions to a human maintainer.

## Read-only by design

Patch Radar does not:

- create pull requests
- comment on issues or pull requests
- tag maintainers
- mutate remote repositories
- clone forks
- execute fork code
- call AI services during scans

The `scan` command uses GitHub API metadata, branch refs, compare data, and diff summaries only.

## Installation

Patch Radar is not published to npm yet. Install it from source for now:

```bash
git clone https://github.com/MekuraRabbit/patch-radar.git
cd patch-radar
npm install
npm run build
npm link
```

## Usage

```bash
patch-radar scan owner/repo
patch-radar scan owner/repo --json
```

Resource controls are available from the first release:

```bash
patch-radar scan owner/repo \
  --max-forks 20 \
  --max-branches-per-fork 10 \
  --concurrency 4 \
  --timeout-ms 10000
```

## Authentication

Patch Radar reads a GitHub token from `GH_TOKEN` or `GITHUB_TOKEN` when present. The token is used only for read-only API requests and is redacted from user-facing errors.

Unauthenticated scans are allowed but may hit lower GitHub rate limits.

## Exit codes

| Code | Meaning                                     |
| ---- | ------------------------------------------- |
| 0    | Success, including no candidates found      |
| 1    | Invalid CLI usage or invalid repository ref |
| 2    | GitHub/API/auth/rate-limit failure          |
| 3    | Unexpected internal error                   |

## Stable JSON output

`--json` output is treated as a public interface for v0.1. It uses the schema version `patch-radar.scan.v0.1`.

Top-level fields:

- `schemaVersion`: stable schema identifier
- `repository`: scanned repository `{ owner, name, fullName }`
- `baseBranch`: upstream default branch used for comparisons
- `generatedAt`: ISO timestamp for the scan report
- `limits`: effective resource controls
- `candidates`: deterministic list of patch candidates
- `warnings`: non-fatal warnings collected during the scan

Each candidate contains:

- `id`: stable candidate id derived from base repository, source repository, branch, and head SHA
- `source`: fork repository, branch, and head SHA
- `base`: upstream repository and branch
- `compareUrl`: GitHub compare URL
- `updatedAt`: latest compared commit timestamp when available
- `score`: evidence-based score
- `scoreComponents`: transparent scoring components
- `diff`: file, line, commit, and ahead/behind counts
- `changedFiles`: changed file summaries
- `issueReferences`: observable issue references from branch names and commit messages
- `testsChanged`: whether test-looking files changed
- `riskSignals`: observable risk signals

## Evidence-based ranking

Patch Radar ranks candidate branches by patch evidence only. It does not score humans, fork owners, contributor trustworthiness, or whether code is AI-generated.

Positive evidence includes issue references, tests changed, recent updates, and small diff size. Risk signals include dependency files, lockfiles, CI files, install scripts, auth/security-sensitive files, crypto files, generated files, binaries, and large diffs.

Risk signals are evidence for maintainer review. They are not claims that a patch is unsafe.

## Development

```bash
npm install
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Default tests do not make live network calls.
