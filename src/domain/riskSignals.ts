import type {
  ChangedFile,
  DiffSummary,
  RiskSignal,
  RiskSignalKind
} from "./types.js";

const LARGE_DIFF_FILE_THRESHOLD = 50;
const LARGE_DIFF_CHANGE_THRESHOLD = 1000;

const RISK_SIGNAL_ORDER: readonly RiskSignalKind[] = [
  "dependency-file",
  "lockfile",
  "ci-file",
  "install-script",
  "auth-file",
  "crypto-file",
  "security-sensitive-file",
  "generated-file",
  "binary-file",
  "large-diff"
];

const DEPENDENCY_FILES = new Set([
  "cargo.toml",
  "composer.json",
  "gemfile",
  "go.mod",
  "mix.exs",
  "package.json",
  "poetry.lock",
  "pyproject.toml",
  "requirements.txt"
]);

const LOCKFILES = new Set([
  "bun.lock",
  "bun.lockb",
  "cargo.lock",
  "composer.lock",
  "gemfile.lock",
  "go.sum",
  "mix.lock",
  "package-lock.json",
  "pnpm-lock.yaml",
  "poetry.lock",
  "yarn.lock"
]);

const BINARY_EXTENSIONS = new Set([
  ".7z",
  ".avif",
  ".dll",
  ".dylib",
  ".exe",
  ".gif",
  ".gz",
  ".ico",
  ".jar",
  ".jpeg",
  ".jpg",
  ".pdf",
  ".png",
  ".so",
  ".tar",
  ".wasm",
  ".webp",
  ".zip"
]);

export function classifyRiskSignals(
  changedFiles: readonly ChangedFile[],
  diff: DiffSummary
): RiskSignal[] {
  const signals = new Map<string, RiskSignal>();
  const sortedFiles = [...changedFiles].sort((left, right) =>
    left.path.localeCompare(right.path)
  );

  for (const file of sortedFiles) {
    const normalizedPath = normalizePath(file.path);
    const baseName = getBaseName(normalizedPath);

    if (DEPENDENCY_FILES.has(baseName)) {
      addSignal(signals, "dependency-file", file.path);
    }

    if (LOCKFILES.has(baseName)) {
      addSignal(signals, "lockfile", file.path);
    }

    if (isCiFile(normalizedPath)) {
      addSignal(signals, "ci-file", file.path);
    }

    if (isInstallScript(normalizedPath, file)) {
      addSignal(signals, "install-script", file.path);
    }

    if (isAuthFile(normalizedPath)) {
      addSignal(signals, "auth-file", file.path);
    }

    if (isCryptoFile(normalizedPath)) {
      addSignal(signals, "crypto-file", file.path);
    }

    if (isSecuritySensitiveFile(normalizedPath)) {
      addSignal(signals, "security-sensitive-file", file.path);
    }

    if (isGeneratedFile(normalizedPath)) {
      addSignal(signals, "generated-file", file.path);
    }

    if (isBinaryFile(normalizedPath, file)) {
      addSignal(signals, "binary-file", file.path);
    }
  }

  if (
    diff.filesChanged >= LARGE_DIFF_FILE_THRESHOLD ||
    diff.totalChanges >= LARGE_DIFF_CHANGE_THRESHOLD
  ) {
    addSignal(
      signals,
      "large-diff",
      `${diff.filesChanged} files, ${diff.totalChanges} changed lines`
    );
  }

  return [...signals.values()].sort(compareRiskSignals);
}

function addSignal(
  signals: Map<string, RiskSignal>,
  kind: RiskSignalKind,
  evidence: string
): void {
  const key = `${kind}:${evidence}`;

  if (!signals.has(key)) {
    signals.set(key, {
      kind,
      severity: "review",
      evidence
    });
  }
}

function compareRiskSignals(left: RiskSignal, right: RiskSignal): number {
  return (
    RISK_SIGNAL_ORDER.indexOf(left.kind) -
      RISK_SIGNAL_ORDER.indexOf(right.kind) ||
    left.evidence.localeCompare(right.evidence)
  );
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").toLowerCase();
}

function getBaseName(path: string): string {
  const parts = path.split("/");
  return parts.at(-1) ?? path;
}

function isCiFile(path: string): boolean {
  return (
    path.startsWith(".github/workflows/") ||
    path.includes("/.github/workflows/") ||
    path === ".gitlab-ci.yml" ||
    path.endsWith("/.gitlab-ci.yml") ||
    path === ".travis.yml" ||
    path.endsWith("/.travis.yml") ||
    path === "azure-pipelines.yml" ||
    path.endsWith("/azure-pipelines.yml") ||
    path.includes("/.circleci/")
  );
}

function isInstallScript(path: string, file: ChangedFile): boolean {
  const baseName = getBaseName(path);
  const patchText = file.patch ?? "";

  return (
    /^(install|setup|bootstrap)\.(sh|bash|ps1|cmd|bat)$/u.test(baseName) ||
    (baseName === "package.json" &&
      /\b(preinstall|install|postinstall)\b/u.test(patchText))
  );
}

function isAuthFile(path: string): boolean {
  return /(^|\/)(auth|oauth|login|session|token|credential|credentials|permission|permissions|rbac|acl)(\.|\/|-|_)/u.test(
    path
  );
}

function isCryptoFile(path: string): boolean {
  return /(^|\/)(crypto|cryptography|encrypt|encryption|decrypt|tls|ssl|cert|certificate|jwt)(\.|\/|-|_)/u.test(
    path
  );
}

function isSecuritySensitiveFile(path: string): boolean {
  return (
    path.startsWith(".github/workflows/") ||
    path.includes("/.github/workflows/") ||
    path.includes("/security/") ||
    path.includes("/secrets/") ||
    path.includes("/deploy/") ||
    path.includes("/release/") ||
    path.includes("/dockerfile") ||
    path.endsWith("/dockerfile") ||
    path === "dockerfile" ||
    path.endsWith(".pem") ||
    path.endsWith(".key")
  );
}

function isGeneratedFile(path: string): boolean {
  return (
    path.startsWith("dist/") ||
    path.startsWith("build/") ||
    path.includes("/dist/") ||
    path.includes("/build/") ||
    path.includes("/generated/") ||
    path.includes("/__generated__/") ||
    path.includes(".generated.") ||
    path.endsWith(".min.js") ||
    path.endsWith(".snap")
  );
}

function isBinaryFile(path: string, file: ChangedFile): boolean {
  if (file.isBinary) {
    return true;
  }

  return BINARY_EXTENSIONS.has(getExtension(path));
}

function getExtension(path: string): string {
  const baseName = getBaseName(path);
  const dotIndex = baseName.lastIndexOf(".");

  if (dotIndex < 0) {
    return "";
  }

  return baseName.slice(dotIndex);
}
