export type GitHubApiErrorCode = "api" | "auth" | "rate-limit" | "timeout";

export class GitHubApiError extends Error {
  public readonly status: number;
  public readonly code: GitHubApiErrorCode;
  public readonly retryAfter: string | null;
  public readonly rateLimitReset: string | null;

  public constructor(
    message: string,
    options: {
      status: number;
      code: GitHubApiErrorCode;
      retryAfter: string | null;
      rateLimitReset: string | null;
    }
  ) {
    super(message);
    this.name = "GitHubApiError";
    this.status = options.status;
    this.code = options.code;
    this.retryAfter = options.retryAfter;
    this.rateLimitReset = options.rateLimitReset;
  }
}

export function redactSecretsFromError(
  message: string,
  secrets: readonly (string | null)[]
): string {
  let redactedMessage = message;

  for (const secret of secrets) {
    if (secret !== null && secret.length > 0) {
      redactedMessage = redactedMessage.split(secret).join("[redacted]");
    }
  }

  return redactedMessage;
}
