import type { ChangedFile } from "./types.js";

const TEST_PATH_PATTERN =
  /(^|\/)(__tests__|tests?|spec)(\/|$)|(\.|-)(test|spec)\.[A-Za-z0-9]+$/u;

export function detectTestsChanged(
  changedFiles: readonly ChangedFile[]
): boolean {
  return changedFiles.some((file) =>
    TEST_PATH_PATTERN.test(normalizePath(file.path))
  );
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").toLowerCase();
}
