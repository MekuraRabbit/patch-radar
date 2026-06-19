# AGENTS.md

## Project identity

Patch Radar is a maintainer-first open source tool for discovering useful patch work that already exists outside the main repository, especially in forks and branches, without adding noise to a maintainer's pull request or issue queue.

The product stance is deliberately passive and respectful:

- Discover and summarize possible patches.
- Show evidence and risk signals.
- Help a human maintainer decide what to inspect.
- Do not push, comment, open pull requests, tag maintainers, or mutate remote repositories by default.

Patch Radar exists to reduce maintainer burden in the AI-assisted contribution era. It must not become another source of automated PR spam.

## Current product scope

Default MVP commands:

```bash
patch-radar scan owner/repo
patch-radar issue owner/repo 347
patch-radar show owner/repo --candidate <candidate-id>
```

MVP should focus on read-only discovery:

- List forks and branches that are ahead of upstream.
- Find recent candidate patch branches.
- Summarize changed files, commit messages, diff stats, and possible issue references.
- Detect whether tests were added or changed.
- Detect obvious risk signals such as dependency, CI, install script, auth, crypto, generated, binary, or very large changes.
- Produce human-readable output and stable machine-readable JSON output.

Out of scope unless explicitly requested by the project owner:

- Creating pull requests.
- Posting GitHub comments.
- Auto-labeling issues or PRs.
- Running untrusted fork code automatically.
- Calling LLM APIs as part of normal scan behavior.
- Ranking contributors as people rather than ranking patch evidence.

## Repository expectations

Use the repository's existing toolchain, package manager, formatting, and test setup when present. Do not replace them casually.

If the repository is empty, bootstrap a high-quality TypeScript CLI project unless the task explicitly chooses a different stack.

Recommended empty-repo baseline:

- TypeScript with `strict` enabled.
- ESM modules.
- A small CLI entrypoint named `patch-radar`.
- Vitest or the repository's chosen test runner.
- ESLint and Prettier or the repository's chosen lint/format tools.
- CI that runs format check, lint, typecheck, and tests.
- `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, and a license file once the owner chooses the license.

Before adding a production dependency, justify why the standard library or an existing dependency is not enough. Prefer boring, well-maintained dependencies with clear value. Do not add dependencies for tiny utilities.

Do not change the license, package name, public command names, or public JSON schema without explicit owner instruction.

## Architecture principles

Keep the codebase easy for outside contributors to read. Prefer simple modules with clear boundaries over clever abstractions.

Suggested layout for a TypeScript implementation:

```text
src/
  cli/                  # argument parsing, command wiring, terminal output
  config/               # config loading, env parsing, defaults
  domain/               # pure domain types and logic; no network or filesystem
  github/               # GitHub REST/GraphQL clients, pagination, rate-limit handling
  git/                  # local git operations, patch application helpers
  ranking/              # candidate scoring and risk signal classification
  reports/              # human, JSON, and markdown renderers
  testing/              # test helpers and fixtures only

tests/
  fixtures/             # recorded/synthetic GitHub responses and diff samples
  integration/          # opt-in tests requiring network or local git

docs/
  design/               # architecture notes and decision records
```

Keep domain logic independent from GitHub and CLI adapters. Business logic should be testable without network access.

Good boundaries:

- CLI modules parse inputs and render outputs only.
- GitHub modules fetch raw data and convert it into typed adapter models.
- Domain modules define `RepositoryRef`, `ForkRef`, `BranchRef`, `PatchCandidate`, `DiffSummary`, `RiskSignal`, and related pure operations.
- Ranking modules turn evidence into transparent scores and explanations.
- Report modules format already-computed results.

Avoid hidden network calls inside domain or rendering functions.

## Code quality bar

Write code as if it will be read by a tired maintainer reviewing it late at night.

Prefer:

- Clear names over short names.
- Small functions with one job.
- Domain language over generic names.
- Explicit data models over unstructured objects.
- Pure functions for parsing, classification, scoring, and formatting decisions.
- Dependency injection for network clients, clocks, filesystem access, and command runners.
- Early validation at boundaries, then strongly typed internals.
- Deterministic behavior in tests.

Avoid:

- Clever one-liners that hide control flow.
- Large functions that mix fetching, scoring, and rendering.
- `any`, `// @ts-ignore`, unchecked type assertions, and broad `catch` blocks that swallow errors.
- Global mutable state.
- Test suites that require live GitHub access by default.
- Snapshot tests for unstable output unless the unstable fields are normalized.
- Rewriting large unrelated areas of the codebase during small tasks.

Public functions, exported types, CLI flags, JSON fields, and non-obvious algorithms must be documented. Internal helper functions do not need verbose comments when names and tests explain them well.

A readable function is usually better than a highly generic reusable function. Extract helpers when they clarify intent, reduce duplication, or make testing easier. Do not create abstraction layers only because the code might need them later.

Examples of preferred function names:

```ts
collectForkBranches(...)
summarizeBranchDiff(...)
extractIssueReferences(...)
classifyRiskSignals(...)
rankPatchCandidates(...)
renderScanReport(...)
redactSecretsFromError(...)
```

Examples of names to avoid:

```ts
handle(...)
process(...)
doStuff(...)
getData(...)
magic(...)
manager(...)
```

## GitHub and network behavior

Patch Radar must be respectful of GitHub, repositories, and maintainers.

- Use read-only GitHub API permissions by default.
- Read tokens from `GH_TOKEN` or `GITHUB_TOKEN` when needed.
- Never print tokens, authorization headers, private URLs, or environment secrets.
- Redact credentials in errors, logs, and test fixtures.
- Handle pagination intentionally.
- Handle rate limits and secondary rate limits gracefully.
- Respect `Retry-After` and rate-limit reset information when available.
- Use bounded concurrency. Prefer a conservative default.
- Cache or reuse data when it improves reliability and reduces API pressure.
- Make network timeouts explicit.
- Make offline/unit tests independent from live API calls.

Default behavior must not mutate remote state. Any future write operation must require:

1. An explicit command name that communicates the write.
2. A dry-run mode.
3. A confirmation flag such as `--confirm`.
4. Documentation explaining the side effect.
5. Tests covering refusal, dry-run, and confirmed behavior.

## Security and safety

Treat fork code as untrusted.

- Do not execute code from forks during scan commands.
- Do not run install scripts from untrusted forks automatically.
- Do not pass the user's GitHub token or local secrets into commands that inspect or test fork code.
- Any future `try` or `apply` command must warn clearly before checking out or running untrusted code.
- Any command that runs tests from a fork must use the safest available isolation path and must scrub sensitive environment variables.
- Do not send repository code, diffs, issue content, or contributor metadata to third-party AI services unless the user explicitly enables that feature and documentation explains the privacy tradeoff.
- Telemetry must be absent by default. Any telemetry must be opt-in, documented, minimal, and easy to disable.

Security-sensitive files include, but are not limited to:

- Authentication and authorization code.
- Cryptography code.
- CI workflow files.
- Package manager files and lockfiles.
- Install scripts.
- Release scripts.
- Dockerfiles and container build files.
- GitHub Actions and other automation configuration.
- Generated files and binaries.

When a patch touches security-sensitive files, show the signal. Do not claim the patch is unsafe; provide evidence and let the maintainer decide.

## Candidate scoring and language

Patch Radar should explain why a candidate is interesting. It should not pretend to know whether a patch is correct.

Use evidence-based language:

- Good: "mentions issue #347", "adds a test file", "touches dependency files", "diff is large", "branch updated 3 days ago".
- Avoid: "trusted contributor", "bad patch", "AI slop", "safe to merge", "definitely fixes the bug".

Scoring must be transparent. If a score exists, return its component signals. A maintainer should be able to disagree with the score and still find the evidence useful.

Do not rank people. Rank patch candidates by observable patch evidence.

Candidate IDs should be stable and deterministic where possible. Prefer deriving them from repository, fork owner, branch name, and head commit SHA.

## CLI UX

The CLI must be useful for both humans and scripts.

- Provide helpful `--help` output for every command.
- Support `--json` for stable machine-readable output.
- Avoid color when stdout is not a TTY.
- Provide `--no-color` when colored output exists.
- Make error messages actionable.
- Use non-zero exit codes for invalid input, API failure, and unexpected internal errors.
- Keep successful human output concise by default.
- Provide verbose/debug modes for troubleshooting without leaking secrets.

Examples of preferred error style:

```text
Could not fetch forks for owner/repo: GitHub API rate limit exceeded.
Try again after 2026-06-18T12:34:00Z, or authenticate with GH_TOKEN for a higher limit.
```

Avoid vague errors:

```text
failed
something went wrong
undefined is not a function
```

## Testing requirements

Every non-trivial change should include tests.

Minimum expectations:

- Unit tests for parsing, issue-reference extraction, risk classification, scoring, and report rendering.
- Tests for CLI argument validation and error mapping.
- Fixture-based tests for GitHub API response handling.
- Tests for pagination and rate-limit behavior where practical.
- Regression tests for every bug fix.
- No live network calls in default test runs.

Use integration tests only when clearly separated and opt-in, for example behind an environment variable such as `PATCH_RADAR_RUN_INTEGRATION=1`.

When changing behavior, update documentation and tests together.

Do not claim that tests passed unless you actually ran them. If you could not run a check, say exactly which check was not run and why.

## Build, lint, and verification

Use the commands declared by the repository. If no commands exist yet, create standard scripts similar to:

```json
{
  "scripts": {
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "tsc -p tsconfig.json"
  }
}
```

Before marking a task complete, run the relevant checks. For broad changes, run:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If the project uses npm, yarn, bun, make, cargo, or another tool instead, follow the repository's actual commands.

## Documentation expectations

Documentation is part of the product.

Update docs when changing:

- CLI commands or flags.
- JSON output shape.
- GitHub token behavior.
- Security or privacy behavior.
- Candidate scoring logic.
- Risk signal definitions.
- Setup instructions.

README should answer:

- What Patch Radar is.
- What problem it solves for maintainers.
- What it deliberately does not do.
- Installation.
- Basic examples.
- Authentication.
- Output examples.
- Security and privacy notes.

CONTRIBUTING should explain:

- How to set up the project.
- How to run checks.
- How to add fixtures.
- How to propose scoring or risk-signal changes.
- How contributors may use AI responsibly.

## AI-assisted contribution policy

AI assistance is allowed in this repository, but authors are responsible for the final work.

Contributions must satisfy all of the following:

- The contributor understands the change.
- The contributor can explain the change in their own words.
- The change is tested or the testing gap is explicitly documented.
- AI-generated text or code is reviewed for correctness, licensing concerns, security issues, and irrelevant artifacts.
- Do not submit large, unfocused, AI-generated rewrites.
- Do not submit fabricated benchmarks, fabricated test results, or fabricated compatibility claims.

PR descriptions should disclose meaningful AI assistance when it materially shaped the change. Disclosure is not shameful; unverified output is the problem.

## Planning and implementation workflow for Codex

For non-trivial tasks, plan before coding.

A good plan should include:

- Goal.
- Relevant files or modules.
- Proposed design.
- Tests to add or update.
- Risks and edge cases.
- Verification commands.

During implementation:

- Keep diffs focused.
- Prefer incremental changes.
- Preserve public behavior unless the task asks to change it.
- Ask at most three clarifying questions when blocked; otherwise make a reasonable, documented assumption.
- Do not silently skip hard parts. Leave a clear TODO only when it is outside the requested scope and explain why.
- Do not update snapshots blindly.
- Do not remove tests to make a build pass.
- Do not downgrade lint, typecheck, or security settings to avoid fixing issues.

Before final response:

- Summarize what changed.
- List tests/checks run.
- List checks not run, if any.
- Call out risks, follow-up work, or behavior changes.

## Review guidelines

When reviewing code in this repository, prioritize high-impact issues:

- Remote write behavior introduced without explicit confirmation flow.
- Secret leakage in logs, errors, fixtures, or debug output.
- Untrusted fork code execution.
- Live network calls in default tests.
- Missing pagination or rate-limit handling for GitHub API calls.
- Silent error swallowing or vague user-facing errors.
- Unstable or undocumented JSON output changes.
- Overly broad dependencies or new dependencies without justification.
- Large functions that mix I/O, domain logic, and rendering.
- Scoring logic that makes unsupported claims about patch correctness or contributor trustworthiness.
- CLI output that pressures maintainers to merge rather than inspect.
- Missing tests for parsing, scoring, risk classification, or error paths.

Treat documentation bugs as important when they can cause unsafe behavior, wrong expectations, or accidental maintainer spam.

## Definition of done

A change is done only when:

- The implementation matches the requested behavior.
- The design follows the passive, maintainer-first product stance.
- Relevant tests were added or updated.
- Relevant checks pass locally or the failure is clearly explained.
- Documentation is updated when behavior changes.
- Errors are actionable and secrets are redacted.
- Default commands do not perform remote writes.
- Default tests do not require live network access.
- The final response honestly states what was and was not verified.

## Maintainer-first north star

When in doubt, choose the behavior that gives maintainers more control, less inbox pressure, and better evidence.

Patch Radar should help maintainers notice useful work. It should never make them feel chased by automation.
