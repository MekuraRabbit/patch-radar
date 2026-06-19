export interface RuntimeEnvironment {
  GH_TOKEN?: string;
  GITHUB_TOKEN?: string;
}

export function readGitHubToken(env: RuntimeEnvironment): string | null {
  const ghToken = normalizeToken(env.GH_TOKEN);

  if (ghToken !== null) {
    return ghToken;
  }

  return normalizeToken(env.GITHUB_TOKEN);
}

function normalizeToken(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return null;
  }

  return trimmedValue;
}
