import type { RepositoryRef } from "./types.js";

const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

export class InvalidRepositoryRefError extends Error {
  public constructor(input: string) {
    super(
      `Invalid repository ref "${input}". Expected the form owner/repo, for example openai/codex.`
    );
    this.name = "InvalidRepositoryRefError";
  }
}

export function parseRepositoryRef(input: string): RepositoryRef {
  const trimmedInput = input.trim();
  const parts = trimmedInput.split("/");

  if (parts.length !== 2) {
    throw new InvalidRepositoryRefError(input);
  }

  const owner = parts[0] ?? "";
  const name = parts[1] ?? "";

  if (!OWNER_PATTERN.test(owner) || !REPOSITORY_PATTERN.test(name)) {
    throw new InvalidRepositoryRefError(input);
  }

  return {
    owner,
    name,
    fullName: `${owner}/${name}`
  };
}

export function formatRepositoryRef(repository: RepositoryRef): string {
  return repository.fullName;
}
