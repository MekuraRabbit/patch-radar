# Security

Patch Radar treats fork code as untrusted.

The v0.1 scan command is API-only and read-only. It does not clone forks, run install scripts, execute tests from forks, create pull requests, post comments, or mutate remote repositories.

## Tokens and secrets

Patch Radar reads `GH_TOKEN` or `GITHUB_TOKEN` for read-only GitHub API requests. Tokens must never be printed in logs, errors, fixtures, or debug output.

If you find a secret leak or a path where fork code can execute during a default scan, please report it privately to the project maintainer.

## Risk signals

Patch Radar reports observable risk signals such as dependency files, lockfiles, CI files, install scripts, auth/security-sensitive files, crypto files, generated files, binaries, and large diffs.

These signals are prompts for human review. They are not claims that a patch is unsafe.
