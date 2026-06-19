import {
  DEFAULT_SCAN_LIMITS,
  MAX_SCAN_LIMITS,
  MIN_TIMEOUT_MS
} from "../config/defaults.js";
import type { ScanLimits } from "../domain/types.js";
import { parseRepositoryRef } from "../domain/repository.js";
import type { RepositoryRef } from "../domain/types.js";

export interface ScanCommandOptions {
  repository: RepositoryRef;
  json: boolean;
  noColor: boolean;
  limits: ScanLimits;
}

export type ParsedCliCommand =
  | {
      kind: "help";
      text: string;
    }
  | {
      kind: "version";
      text: string;
    }
  | {
      kind: "scan";
      options: ScanCommandOptions;
    };

export class InvalidCliUsageError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InvalidCliUsageError";
  }
}

export const ROOT_HELP = `Usage:
  patch-radar scan owner/repo [options]

Commands:
  scan owner/repo    Discover read-only candidate patch branches.

Options:
  --help                         Show help.
  --version                      Show version.
`;

export const SCAN_HELP = `Usage:
  patch-radar scan owner/repo [options]

Options:
  --json                         Emit stable JSON output.
  --max-forks <count>            Maximum forks to inspect. Default: 20.
  --max-branches-per-fork <n>    Maximum branches to inspect per fork. Default: 10.
  --concurrency <count>          Bounded request concurrency. Default: 4.
  --timeout-ms <milliseconds>    Per-request timeout. Default: 10000.
  --no-color                     Disable color output. Human output is currently plain text.
  --help                         Show scan help.
`;

export function parseCliArguments(argv: readonly string[]): ParsedCliCommand {
  const [command, ...rest] = argv;

  if (command === undefined || command === "--help" || command === "-h") {
    return {
      kind: "help",
      text: ROOT_HELP
    };
  }

  if (command === "--version" || command === "-v") {
    return {
      kind: "version",
      text: "patch-radar 0.1.0\n"
    };
  }

  if (command !== "scan") {
    throw new InvalidCliUsageError(`Unknown command "${command}".`);
  }

  if (rest.includes("--help") || rest.includes("-h")) {
    return {
      kind: "help",
      text: SCAN_HELP
    };
  }

  return {
    kind: "scan",
    options: parseScanArguments(rest)
  };
}

function parseScanArguments(argv: readonly string[]): ScanCommandOptions {
  let repositoryInput: string | null = null;
  let json = false;
  let noColor = false;
  const limits = { ...DEFAULT_SCAN_LIMITS };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === undefined) {
      continue;
    }

    if (!value.startsWith("-")) {
      if (repositoryInput !== null) {
        throw new InvalidCliUsageError(
          `Unexpected positional argument "${value}".`
        );
      }

      repositoryInput = value;
      continue;
    }

    switch (value) {
      case "--json":
        json = true;
        break;
      case "--no-color":
        noColor = true;
        break;
      case "--max-forks":
        limits.maxForks = readIntegerFlag(argv, index, value, {
          minimum: 0,
          maximum: MAX_SCAN_LIMITS.maxForks
        });
        index += 1;
        break;
      case "--max-branches-per-fork":
        limits.maxBranchesPerFork = readIntegerFlag(argv, index, value, {
          minimum: 0,
          maximum: MAX_SCAN_LIMITS.maxBranchesPerFork
        });
        index += 1;
        break;
      case "--concurrency":
        limits.concurrency = readIntegerFlag(argv, index, value, {
          minimum: 1,
          maximum: MAX_SCAN_LIMITS.concurrency
        });
        index += 1;
        break;
      case "--timeout-ms":
        limits.timeoutMs = readIntegerFlag(argv, index, value, {
          minimum: MIN_TIMEOUT_MS,
          maximum: MAX_SCAN_LIMITS.timeoutMs
        });
        index += 1;
        break;
      default:
        throw new InvalidCliUsageError(`Unknown option "${value}".`);
    }
  }

  if (repositoryInput === null) {
    throw new InvalidCliUsageError(
      "Missing repository ref. Expected owner/repo."
    );
  }

  return {
    repository: parseRepositoryRef(repositoryInput),
    json,
    noColor,
    limits
  };
}

function readIntegerFlag(
  argv: readonly string[],
  flagIndex: number,
  flag: string,
  range: {
    minimum: number;
    maximum: number;
  }
): number {
  const rawValue = argv[flagIndex + 1];

  if (rawValue === undefined || rawValue.startsWith("-")) {
    throw new InvalidCliUsageError(`Missing value for ${flag}.`);
  }

  if (!/^\d+$/u.test(rawValue)) {
    throw new InvalidCliUsageError(`${flag} must be an integer.`);
  }

  const value = Number.parseInt(rawValue, 10);

  if (value < range.minimum || value > range.maximum) {
    throw new InvalidCliUsageError(
      `${flag} must be between ${range.minimum} and ${range.maximum}.`
    );
  }

  return value;
}
