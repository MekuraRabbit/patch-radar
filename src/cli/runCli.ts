import { readGitHubToken } from "../config/env.js";
import type { RuntimeEnvironment } from "../config/env.js";
import { InvalidRepositoryRefError } from "../domain/repository.js";
import { GitHubClient } from "../github/apiClient.js";
import { GitHubApiError } from "../github/errors.js";
import type { GitHubReadClient } from "../github/types.js";
import { renderHumanReport } from "../reports/human.js";
import { renderJsonReport } from "../reports/json.js";
import { scanRepository } from "../scan/scanRepository.js";
import {
  InvalidCliUsageError,
  ROOT_HELP,
  parseCliArguments
} from "./arguments.js";

export interface WritableOutput {
  write(chunk: string): void;
}

export interface CliRuntime {
  env: RuntimeEnvironment;
  stdout: WritableOutput;
  stderr: WritableOutput;
  now?: Date;
  createClient?: (options: {
    token: string | null;
    timeoutMs: number;
  }) => GitHubReadClient;
}

export async function runCli(
  argv: readonly string[],
  runtime: CliRuntime
): Promise<number> {
  try {
    const command = parseCliArguments(argv);

    if (command.kind === "help" || command.kind === "version") {
      runtime.stdout.write(command.text);
      return 0;
    }

    const token = readGitHubToken(runtime.env);
    const client = createGitHubClient(runtime, {
      token,
      timeoutMs: command.options.limits.timeoutMs
    });
    const report = await scanRepository(
      client,
      command.options.repository,
      command.options.limits,
      runtime.now ?? new Date()
    );
    const output = command.options.json
      ? renderJsonReport(report)
      : renderHumanReport(report);

    runtime.stdout.write(output);
    return 0;
  } catch (error) {
    if (
      error instanceof InvalidCliUsageError ||
      error instanceof InvalidRepositoryRefError
    ) {
      runtime.stderr.write(formatUsageError(error));
      return 1;
    }

    if (error instanceof GitHubApiError) {
      runtime.stderr.write(`${error.message}\n`);
      return 2;
    }

    const message =
      error instanceof Error ? error.message : "Unexpected internal error";
    runtime.stderr.write(`Unexpected internal error: ${message}\n`);
    return 3;
  }
}

function createGitHubClient(
  runtime: CliRuntime,
  options: {
    token: string | null;
    timeoutMs: number;
  }
): GitHubReadClient {
  if (runtime.createClient !== undefined) {
    return runtime.createClient(options);
  }

  return new GitHubClient(options);
}

function formatUsageError(error: Error): string {
  if (error.message.trim().startsWith("Usage:")) {
    return `${error.message.trimEnd()}\n`;
  }

  return `${error.message}\n\n${ROOT_HELP}`;
}
