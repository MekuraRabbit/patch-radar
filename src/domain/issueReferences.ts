import type { IssueReference, RepositoryRef } from "./types.js";

const GITHUB_URL_REFERENCE =
  /github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)\/(?:issues|pull)\/(\d+)/giu;
const REPOSITORY_SHORTHAND_REFERENCE =
  /(?<![A-Za-z0-9._/-])([A-Za-z0-9-]+\/[A-Za-z0-9._-]+)#(\d+)/gu;
const PLAIN_HASH_REFERENCE = /(?<![A-Za-z0-9._/])#(\d+)/gu;
const GH_REFERENCE = /\bGH-(\d+)\b/giu;

export function extractIssueReferences(
  texts: readonly string[],
  defaultRepository: RepositoryRef
): IssueReference[] {
  const references = new Map<string, IssueReference>();

  for (const text of texts) {
    addUrlReferences(references, text);
    addRepositoryShorthandReferences(references, text);
    addDefaultRepositoryReferences(references, text, defaultRepository);
  }

  return [...references.values()].sort(compareIssueReferences);
}

function addUrlReferences(
  references: Map<string, IssueReference>,
  text: string
): void {
  for (const match of text.matchAll(GITHUB_URL_REFERENCE)) {
    const owner = match[1];
    const name = match[2];
    const number = parseIssueNumber(match[3]);

    if (owner !== undefined && name !== undefined && number !== null) {
      addReference(references, {
        repository: `${owner}/${name}`,
        number,
        raw: match[0]
      });
    }
  }
}

function addRepositoryShorthandReferences(
  references: Map<string, IssueReference>,
  text: string
): void {
  for (const match of text.matchAll(REPOSITORY_SHORTHAND_REFERENCE)) {
    const repository = match[1];
    const number = parseIssueNumber(match[2]);

    if (repository !== undefined && number !== null) {
      addReference(references, {
        repository,
        number,
        raw: match[0]
      });
    }
  }
}

function addDefaultRepositoryReferences(
  references: Map<string, IssueReference>,
  text: string,
  defaultRepository: RepositoryRef
): void {
  for (const match of text.matchAll(PLAIN_HASH_REFERENCE)) {
    const number = parseIssueNumber(match[1]);

    if (number !== null) {
      addReference(references, {
        repository: defaultRepository.fullName,
        number,
        raw: match[0]
      });
    }
  }

  for (const match of text.matchAll(GH_REFERENCE)) {
    const number = parseIssueNumber(match[1]);

    if (number !== null) {
      addReference(references, {
        repository: defaultRepository.fullName,
        number,
        raw: match[0]
      });
    }
  }
}

function addReference(
  references: Map<string, IssueReference>,
  reference: IssueReference
): void {
  const key = `${reference.repository}#${reference.number}`;

  if (!references.has(key)) {
    references.set(key, reference);
  }
}

function parseIssueNumber(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }

  const number = Number.parseInt(value, 10);

  if (!Number.isSafeInteger(number) || number <= 0) {
    return null;
  }

  return number;
}

function compareIssueReferences(
  left: IssueReference,
  right: IssueReference
): number {
  return (
    left.repository.localeCompare(right.repository) ||
    left.number - right.number ||
    left.raw.localeCompare(right.raw)
  );
}
