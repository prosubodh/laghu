#!/usr/bin/env node
// ==============================================================================
// bootstrap_workspace.mjs
// Topology-Aware Deterministic Scaffolder (Strict YAGNI, Zero Speculative Bloat)
//
// Cross-platform Node port of the former bootstrap_workspace.sh. Every emitted
// artifact is byte-for-byte identical to the shell version, except the boundary
// smoke test, which is now scripts/smoke_test.mjs so scaffolded projects carry
// no POSIX-only shell dependency.
// ==============================================================================

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const WORKSPACE_ROOT = process.argv[2] || process.cwd();
const TOPOLOGY = process.argv[3] || "backend";
const LANGUAGE = process.argv[4] || "generic";

// ------------------------------------------------------------------------------
// LANGUAGE is validated, not merely echoed. Unknown values are rejected instead
// of silently producing a generic layout: a wrong-but-successful scaffold hides
// typos from the agent and surfaces much later.
// ------------------------------------------------------------------------------
const LANGUAGES = [
  "typescript",
  "javascript",
  "python",
  "rust",
  "go",
  "java",
  "csharp",
  "cpp",
  "c",
  "generic",
  "deno",
  "bun",
];

function fail(lines) {
  for (const line of lines) console.error(line);
  process.exit(2);
}

function isFile(target) {
  return fs.existsSync(target) && fs.statSync(target).isFile();
}

// ------------------------------------------------------------------------------
// PROTECTED TARGETS. The scaffolder creates directories and files, so it must
// never run against the filesystem root, the user's home directory, or the home
// directory's parent (scaffolding into /home or C:\Users affects every user on
// the machine). This mirrors lib/scaffold.js isProtectedTarget(), which enforces
// the same rule -- plus template-ancestor and symlink checks -- for the Node
// scaffolder with E_TARGET_IS_PROTECTED.
//
// The check runs BEFORE anything is created: even the .azcodr profile write must
// not execute for a protected target.
// ------------------------------------------------------------------------------
function resolveAbsolute(p) {
  const abs = path.resolve(p);
  try {
    return fs.realpathSync.native(abs);
  } catch {
    // Path does not exist yet: canonicalize the nearest existing ancestor.
    try {
      return path.join(fs.realpathSync.native(path.dirname(abs)), path.basename(abs));
    } catch {
      return abs;
    }
  }
}

function lowercase(value) {
  return value.toLowerCase();
}

function protectedReason(resolvedRoot, resolvedHome) {
  const lowerRoot = lowercase(resolvedRoot);
  const homeParent = path.dirname(resolvedHome);
  if (resolvedRoot === "/") return "the filesystem root";
  // Git-Bash drive root (/c, /d, ...).
  if (/^\/[a-zA-Z]$/.test(resolvedRoot)) return "a drive root";
  // Native Windows drive root (C:\, D:).
  if (/^[a-zA-Z]:[\\/]?$/.test(resolvedRoot)) return "a drive root";
  if (lowerRoot === lowercase(resolvedHome)) return `the home directory (${resolvedHome})`;
  if (lowerRoot === lowercase(homeParent)) return `the home directory's parent (${homeParent})`;
  return "";
}

// ------------------------------------------------------------------------------

console.log(`🚀 Initializing Topology-Aware Workspace in: ${WORKSPACE_ROOT}`);
console.log(`🏗️ Target Topology: ${TOPOLOGY}`);
console.log(`📦 Target Language Profile: ${LANGUAGE}`);
console.log("--------------------------------------------------------------");

if (!LANGUAGES.includes(LANGUAGE)) {
  fail([
    `❌ Unknown language profile: '${LANGUAGE}'`,
    "",
    "Supported language profiles:",
    "  typescript  javascript  deno  bun  python  rust  go  java  csharp  cpp  c",
    "  generic",
    "",
    "Use 'generic' when the language has not been decided yet.",
  ]);
}

const RESOLVED_ROOT = resolveAbsolute(WORKSPACE_ROOT);
// Home resolution mirrors the former shell version's "${HOME:-/nonexistent-home}"
// exactly: an explicit HOME wins (harnesses and tests pin it), then the platform
// default. os.homedir() alone ignores HOME on Windows -- proven on win32 -- which
// would silently defeat the home and home-parent checks of the guard below.
const RESOLVED_HOME = resolveAbsolute(
  process.env.HOME || os.homedir() || "/nonexistent-home",
);
const REASON = protectedReason(RESOLVED_ROOT, RESOLVED_HOME);

if (REASON && process.env.AZCODR_ALLOW_PROTECTED !== "1") {
  fail([
    `❌ Refusing to scaffold into protected directory: ${RESOLVED_ROOT} (${REASON}).`,
    "   Choose a project subdirectory instead.",
    "   Embedders that genuinely need this path: AZCODR_ALLOW_PROTECTED=1 <this command>",
  ]);
}

// Record the decided language so downstream phases can read it instead of
// re-deriving it (and so the scaffolder's own claim is verifiable).
fs.mkdirSync(path.join(WORKSPACE_ROOT, ".azcodr"), { recursive: true });
fs.writeFileSync(
  path.join(WORKSPACE_ROOT, ".azcodr", "workspace-profile.env"),
  `topology=${TOPOLOGY}\nlanguage=${LANGUAGE}\n`,
);

// Helper to create leaf directory with .gitkeep to ensure Git tracks empty structures
function createLeaf(dir) {
  fs.mkdirSync(dir, { recursive: true });
  if (fs.readdirSync(dir).length === 0) {
    fs.writeFileSync(path.join(dir, ".gitkeep"), "");
  }
}

const TOKENS_JSON = `{
  "color": {
    "brand": {
      "primary": { "$value": "#2563eb", "$type": "color" },
      "secondary": { "$value": "#475569", "$type": "color" },
      "accent": { "$value": "#f59e0b", "$type": "color" }
    }
  },
  "dimension": {
    "radius": {
      "base": { "$value": "6px", "$type": "dimension" }
    }
  }
}
`;

const R = (...parts) => path.join(WORKSPACE_ROOT, ...parts);

function scaffoldTopology() {
  switch (TOPOLOGY) {
    case "extension":
      console.log("1. Scaffolding Browser Extension Source Tree (src/)...");
      createLeaf(R("src/background"));
      createLeaf(R("src/content"));
      createLeaf(R("src/popup"));
      createLeaf(R("src/shared"));
      createLeaf(R("public"));
      console.log("2. Scaffolding Extension Test Suites (tests/)...");
      createLeaf(R("tests/unit"));
      createLeaf(R("tests/e2e"));
      return;

    case "game":
    case "engine":
      console.log("1. Scaffolding Game/Engine Source Tree (src/)...");
      createLeaf(R("src/core"));
      createLeaf(R("src/ecs"));
      createLeaf(R("src/renderer"));
      createLeaf(R("src/assets"));
      console.log("2. Scaffolding Game/Engine Test Suites (tests/)...");
      createLeaf(R("tests/unit"));
      createLeaf(R("tests/benchmarks"));
      return;

    case "cli":
      console.log("1. Scaffolding CLI Source Tree (src/)...");
      createLeaf(R("src/cmd"));
      createLeaf(R("src/core"));
      createLeaf(R("src/io"));
      console.log("2. Scaffolding CLI Test Suites (tests/)...");
      createLeaf(R("tests/unit"));
      createLeaf(R("tests/integration"));
      return;

    case "web":
    case "saas":
    case "fullstack":
      console.log("1. Scaffolding Backend / Enterprise Source Tree (src/)...");
      createLeaf(R("src/domain/entities"));
      createLeaf(R("src/domain/value_objects"));
      createLeaf(R("src/domain/services"));
      createLeaf(R("src/ports/primary"));
      createLeaf(R("src/ports/secondary"));
      createLeaf(R("src/adapters/primary"));
      createLeaf(R("src/adapters/secondary"));
      console.log("2. Scaffolding Web Frontend Client Source Tree (client/)...");
      createLeaf(R("client/src/components/layout"));
      createLeaf(R("client/src/components/ui"));
      createLeaf(R("client/src/pages"));
      createLeaf(R("client/src/hooks"));
      createLeaf(R("client/src/services"));
      createLeaf(R("client/public"));
      console.log("3. Scaffolding Specifications (specs/)...");
      createLeaf(R("specs/openapi"));
      createLeaf(R("specs/tokens"));
      console.log("4. Scaffolding Fullstack Test Suites (tests/)...");
      createLeaf(R("tests/unit"));
      createLeaf(R("tests/integration"));
      createLeaf(R("tests/contracts"));
      createLeaf(R("tests/client"));
      createLeaf(R("tests/acceptance"));
      console.log("5. Scaffolding Deployment Infrastructure (deploy/)...");
      createLeaf(R("deploy/docker"));
      createLeaf(R("deploy/compose"));
      writeTokensIfAbsent();
      return;

    case "backend":
      console.log("1. Scaffolding Headless Backend Source Tree (src/)...");
      createLeaf(R("src/domain/entities"));
      createLeaf(R("src/domain/value_objects"));
      createLeaf(R("src/domain/services"));
      createLeaf(R("src/ports/primary"));
      createLeaf(R("src/ports/secondary"));
      createLeaf(R("src/adapters/primary"));
      createLeaf(R("src/adapters/secondary"));
      console.log("2. Scaffolding Specifications (specs/)...");
      createLeaf(R("specs/openapi"));
      createLeaf(R("specs/tokens"));
      console.log("3. Scaffolding Backend Test Suites (tests/)...");
      createLeaf(R("tests/unit"));
      createLeaf(R("tests/integration"));
      createLeaf(R("tests/contracts"));
      createLeaf(R("tests/acceptance"));
      console.log("4. Scaffolding Deployment Infrastructure (deploy/)...");
      createLeaf(R("deploy/docker"));
      createLeaf(R("deploy/compose"));
      writeTokensIfAbsent();
      return;

    case "frontend":
      console.log("1. Scaffolding Frontend Client Source Tree (src/)...");
      createLeaf(R("src/components/layout"));
      createLeaf(R("src/components/ui"));
      createLeaf(R("src/pages"));
      createLeaf(R("src/hooks"));
      createLeaf(R("src/services"));
      createLeaf(R("public"));
      console.log("2. Scaffolding Specifications (specs/)...");
      createLeaf(R("specs/tokens"));
      console.log("3. Scaffolding Frontend Test Suites (tests/)...");
      createLeaf(R("tests/unit"));
      createLeaf(R("tests/acceptance"));
      return;

    case "canvas-game":
    case "canvas":
    case "webgame":
      // Topology D: Browser / Canvas Game (HTML5 Canvas / WebGL / WebGPU).
      // Game Loop shaped: Input -> Update -> Render.
      console.log("1. Scaffolding Canvas Game Source Tree (game loop shaped)...");
      createLeaf(R("src/entities"));
      createLeaf(R("src/systems/update"));
      createLeaf(R("src/systems/render"));
      createLeaf(R("src/input"));
      createLeaf(R("src/audio"));
      createLeaf(R("src/ui"));
      createLeaf(R("src/scenes"));
      createLeaf(R("src/config"));
      console.log("2. Scaffolding Canvas Game Tests (tests/)...");
      createLeaf(R("tests/unit"));
      createLeaf(R("tests/e2e"));
      console.log("3. Scaffolding Public Assets (public/)...");
      createLeaf(R("public/assets"));
      return;

    case "systems-library":
    case "embedded":
    case "systems":
      // Topology F: Embedded / Systems Library.
      // No heap assumptions, no dynamic allocation in the hot path.
      console.log("1. Scaffolding Systems Library Source Tree (src/)...");
      createLeaf(R("src/core"));
      createLeaf(R("src/hal"));
      createLeaf(R("src/drivers"));
      createLeaf(R("src/protocol"));
      createLeaf(R("src/utils"));
      console.log("2. Scaffolding Systems Library Tests (tests/)...");
      createLeaf(R("tests/unit"));
      createLeaf(R("tests/hal"));
      createLeaf(R("tests/benchmarks"));
      return;

    default:
      // Fail loudly rather than scaffolding a generic tree and exiting 0. A
      // wrong-but-successful scaffold is worse than a refusal: the agent reports
      // success to the user and the mismatch surfaces much later.
      fail([
        `❌ Unknown topology: '${TOPOLOGY}'`,
        "",
        "Supported topologies:",
        "  extension        Topology B  Browser Extension (Manifest V3)",
        "  game|engine      Topology C  Game Engine / High-Performance Simulator",
        "  canvas-game      Topology D  Browser / Canvas Game (Canvas/WebGL/WebGPU)",
        "  cli              Topology E  Desktop Application / CLI Utility",
        "  backend          Topology A  Headless API / Service",
        "  web|saas|fullstack Topology A  Fullstack Web Application",
        "  frontend         Topology A  Frontend-only Client",
        "  systems-library  Topology F  Embedded / Systems Library",
        "",
        "Re-run with one of the above.",
      ]);
  }
}

function writeTokensIfAbsent() {
  const target = R("specs/tokens/tokens.json");
  if (!isFile(target)) fs.writeFileSync(target, TOKENS_JSON);
}

scaffoldTopology();

// ------------------------------------------------------------------------------
// DETERMINISTIC TOOLCHAIN FILES. Directories alone enforce nothing. Each profile
// below emits its pinned gate configuration with values mirroring
// docs/rules/clean_code.md (300/30/10/3); the agent installs the named tool and
// proves the gate in Phase 5. Files are created only when absent, so re-runs
// never clobber agent-authored configs. Build manifests (Cargo.toml, go.mod,
// csproj, ...) stay with the agent: they carry project naming and version
// decisions no script may invent.
// ------------------------------------------------------------------------------
function writeUnlessExists(target, content) {
  if (isFile(target)) {
    console.log(`   keeping existing ${target}`);
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function appendUnlessPresent(target, marker, content) {
  if (isFile(target) && fs.readFileSync(target, "utf8").includes(marker)) {
    console.log(`   keeping existing ${target} gates`);
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.appendFileSync(target, content);
}

function emitToolchain() {
  switch (LANGUAGE) {
    case "typescript":
    case "javascript":
    case "deno":
    case "bun":
      writeUnlessExists(
        R("eslint.config.js"),
        `// Deterministic fitness functions (azcodr clean_code.md section 5).
// Install the pinned tool, then prove the gate: npm run lint
export default [
  {
    files: ['src/**/*.{js,ts}', 'tests/**/*.{js,ts}'],
    rules: {
      'max-lines': ['error', 300],
      'max-lines-per-function': ['error', 30],
      complexity: ['error', 10],
      'max-params': ['error', 3]
    }
  }
];
`,
      );
      return;

    case "python":
      writeUnlessExists(
        R("ruff.toml"),
        `# Deterministic fitness functions (azcodr clean_code.md section 5).
# Install the pinned tool, then prove the gate: ruff check .
[lint]
select = ["E", "F", "C901", "PLR0912", "PLR0913", "PLR0915"]
[lint.mccabe]
max-complexity = 10
[lint.pylint]
max-args = 3
max-statements = 30
# NOTE: ruff has no file-length rule; the 300-line file cap is enforced by
# the project's lint entry (see lets-build Phase 5 proof).
`,
      );
      return;

    case "rust":
      writeUnlessExists(
        R("clippy.toml"),
        `# Deterministic fitness functions (azcodr clean_code.md section 5).
# Enforce with: cargo clippy -- -D clippy::too_many_lines -D clippy::cognitive_complexity -D clippy::too_many_arguments
too-many-lines-threshold = 30
cognitive-complexity-threshold = 10
too-many-arguments-threshold = 3
# NOTE: clippy has no file-length lint; the 300-line file cap is enforced by
# the project's lint entry (see lets-build Phase 5 proof).
`,
      );
      return;

    case "go":
      writeUnlessExists(
        R(".golangci.yml"),
        `# Deterministic fitness functions (azcodr clean_code.md section 5).
# Install the pinned tool, then prove the gate: golangci-lint run ./...
linters:
  enable: [funlen, gocyclo]
linters-settings:
  funlen:
    lines: 30
    statements: 25
  gocyclo:
    min-complexity: 10
# NOTE: no golangci-native file-length check; the 300-line file cap is
# enforced by the project's lint entry (see lets-build Phase 5 proof).
`,
      );
      return;

    case "java":
      writeUnlessExists(
        R("checkstyle.xml"),
        `<?xml version="1.0"?>
<!-- Deterministic fitness functions (azcodr clean_code.md section 5). -->
<!DOCTYPE module PUBLIC "-//Checkstyle//DTD Checkstyle Configuration 1.3//EN" "https://checkstyle.org/dtds/configuration_1_3.dtd">
<module name="Checker">
  <module name="FileLength">
    <property name="max" value="300"/>
  </module>
  <module name="TreeWalker">
    <module name="MethodLength">
      <property name="max" value="30"/>
    </module>
    <module name="CyclomaticComplexity">
      <property name="max" value="10"/>
    </module>
    <module name="ParameterNumber">
      <property name="max" value="3"/>
    </module>
  </module>
</module>
`,
      );
      return;

    case "csharp":
      appendUnlessPresent(
        R(".editorconfig"),
        "azcodr fitness functions",
        `
# --- azcodr fitness functions (CA gates; exact numbers in lint entry) ---
[*.cs]
dotnet_diagnostic.CA1501.severity = error
dotnet_diagnostic.CA1502.severity = error
`,
      );
      return;

    case "cpp":
    case "c":
      writeUnlessExists(
        R(".clang-tidy"),
        `# Deterministic fitness functions (azcodr clean_code.md section 5).
Checks: 'readability-function-size,readability-function-cognitive-complexity'
CheckOptions:
  - { key: readability-function-size.LineThreshold, value: 30 }
  - { key: readability-function-size.ParameterThreshold, value: 3 }
  - { key: readability-function-cognitive-complexity.Threshold, value: 10 }
# NOTE: clang-tidy has no file-length check; the 300-line file cap is
# enforced by the project's lint entry (see lets-build Phase 5 proof).
`,
      );
      return;

    case "generic":
      console.log(
        "   language undecided: no toolchain configs emitted (re-run with a language profile)",
      );
      return;

    default:
      return;
  }
}

console.log(`6. Emitting deterministic toolchain configs for '${LANGUAGE}'...`);
emitToolchain();

// For Node profiles the starter package.json ships a lint placeholder that
// always succeeds. Point it at the emitted config so `npm run lint` fails until
// the pinned eslint is installed (fail-closed) instead of echoing. Only the
// placeholder is ever replaced; agent-wired entries are sacred.
if (["typescript", "javascript", "deno", "bun"].includes(LANGUAGE)) {
  const starterPkg = R("package.json");
  if (
    isFile(starterPkg) &&
    fs.readFileSync(starterPkg, "utf8").includes("No linter configured yet")
  ) {
    const pkg = JSON.parse(fs.readFileSync(starterPkg, "utf8"));
    pkg.scripts = pkg.scripts || {};
    pkg.scripts.lint = "eslint .";
    fs.writeFileSync(starterPkg, `${JSON.stringify(pkg, null, 2)}\n`);
    console.log("   wired package.json lint -> eslint .");
  }
}

// ------------------------------------------------------------------------------
// memory.md is an APPEND-ONLY LEDGER. It is never rewritten automatically.
//
// HISTORY (this was a data-loss bug): this script previously overwrote memory.md
// with a template whenever the file contained any ADR heading that was not the
// untouched placeholder. Re-running /lets-build on a live project silently
// destroyed every recorded architectural decision. ADRs are immutable history by
// rule (docs/rules/agentic_configuration.md); a scaffolder has no business
// rewriting them.
//
// Resetting the ledger is now opt-in, always backed up, and always announced.
// ------------------------------------------------------------------------------
const MEMORY_TEMPLATE = `# Workspace Memory, Architecture Decisions & Knowledge Hub

> **Core Purpose:** Authoritative persistent memory ledger for the workspace repository (\`./\`), maintaining Lightweight Architectural Decision Records (ADRs), system topologies, and living domain contracts.

---

## 1. Quick Navigation & Knowledge Repositories

- 📖 **[Living Ubiquitous Language Glossary](./docs/knowledge/ubiquitous_language.md)**: Authoritative, single-name domain vocabulary contract.
- 📜 **[Lightweight ADR Master Index](#adr-master-index)**: Summary of all architectural decisions and direct links to governing rules.

---

## 2. Consolidated Architectural Decision Records (ADRs)

### ADR Master Index

| ID | Title | Date | Status | Governing Rule / Skill |
|---|---|---|---|---|
| *(No decisions recorded yet)* | *Record initial architecture decisions during Phase 3 of /lets-build.* | *YYYY-MM-DD* | *ACCEPTED* | *e.g. [\`clean_code.md\`](./docs/rules/clean_code.md)* |

---

### Lightweight Decision Summaries

<!--
Record project Architectural Decision Records (ADRs) below as decisions are finalized.
Format:

#### ADR-001: [Imperative Title]
- **Date:** YYYY-MM-DD | **Status:** ACCEPTED
- **Context:** Problem space, constraints, and operational context requiring a decision.
- **Decision:** Chosen architecture, invariants, and implementation patterns.
- **Consequences:** Positive benefits and deliberate trade-offs accepted.
- **Enforced In:** Relevant rule files in docs/rules/ or code paths.
-->
`;

function handleMemory() {
  const memoryFile = R("memory.md");
  if (!isFile(memoryFile)) return;
  // Only a genuinely recorded decision counts as "has content": an h4 ADR
  // heading outside of an HTML comment.
  const recordedAdrs = fs
    .readFileSync(memoryFile, "utf8")
    .split("\n")
    .filter((line) => /^####\s+ADR-[0-9]+/.test(line)).length;

  if (recordedAdrs <= 0) return;

  if (process.env.AZCODR_RESET_MEMORY === "1") {
    const backup = `${memoryFile}.bak`;
    fs.copyFileSync(memoryFile, backup);
    console.log(
      `⚠️  AZCODR_RESET_MEMORY=1 -- RESETTING ${recordedAdrs} recorded ADR(s) in memory.md`,
    );
    console.log(`    Backup written to ${backup}`);
    fs.writeFileSync(memoryFile, MEMORY_TEMPLATE);
    return;
  }

  console.log(`🧠 Preserving memory.md: ${recordedAdrs} recorded ADR(s) found.`);
  console.log("    memory.md is append-only and is never rewritten by the scaffolder.");
  console.log("    To intentionally reset the ledger: AZCODR_RESET_MEMORY=1 <this command>");
}

handleMemory();

// Deterministically generate boundary verification smoke test script (Phase 5 requirement)
const SMOKE_TEST = R("scripts/smoke_test.mjs");
if (!isFile(SMOKE_TEST)) {
  console.log("5. Generating boundary smoke test verification script (scripts/smoke_test.mjs)...");
  fs.mkdirSync(R("scripts"), { recursive: true });
  fs.writeFileSync(
    SMOKE_TEST,
    `#!/usr/bin/env node
// ==============================================================================
// Boundary Verification Smoke Test (Phase 5 Verification Gate)
// ==============================================================================
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

console.log("Running boundary smoke verification...");
const guard = path.join(root, ".agents", "scripts", "boundary_guard.js");
if (fs.existsSync(guard)) {
  const result = spawnSync(process.execPath, [guard, path.join(root, "src")], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
} else {
  console.log("⚠️  Boundary guard skipped (guard script unavailable).");
}
// Extend with project-specific runtime health checks (e.g. ping health endpoint, CLI --help)
console.log("✅ Boundary smoke verification passed!");
`,
  );
  fs.chmodSync(SMOKE_TEST, 0o755);
}

console.log("--------------------------------------------------------------");
console.log(`✅ Topology '${TOPOLOGY}' scaffolded with strict YAGNI (0 speculative folders)!`);
console.log("");
console.log("🛑 MANDATORY HANDOVER GATE (ADR-008):");
console.log("   Bootstrapping is COMPLETE. Zero application domain entities have been created.");
console.log("   DO NOT fabricate domain models, entities, or features during lets-build.");
console.log("   Next: invoke 'product-analyst' & 'relentless-questioner' to conduct formal");
console.log("   stakeholder domain analysis, INVEST story decomposition, and Gherkin criteria.");
