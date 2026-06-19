# Contributing

Thank you for helping Patch Radar stay useful to maintainers.

## Setup

```bash
npm install
npm run build
```

## Checks

Run these before proposing changes:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Default tests must not require live GitHub access. Use synthetic fixtures or injected clients for GitHub behavior.

## Architecture

Keep domain logic independent from CLI and GitHub adapters:

- CLI modules parse arguments and render output.
- GitHub modules fetch and normalize read-only API data.
- Domain modules define types and pure parsing/classification logic.
- Ranking modules score candidate patch evidence only.
- Report modules format already-computed scan reports.

Do not add remote write behavior without an explicit command, dry-run mode, confirmation flag, documentation, and tests.

## Fixtures

Use small synthetic fixtures that exercise the behavior under test. Redact tokens, private URLs, authorization headers, and credentials.

## Scoring and risk signals

Scoring must be transparent and based on observable patch evidence. Do not rank people. Do not score contributor trustworthiness. Do not attempt AI-generated-code detection.

When adding a new risk signal, include tests and documentation.

## Responsible AI assistance

AI assistance is welcome, but contributors remain responsible for the final work. Please review generated code for correctness, licensing concerns, security issues, and irrelevant artifacts. Do not submit fabricated tests, benchmarks, or compatibility claims.
