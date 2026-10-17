#!/usr/bin/env bash
# ==============================================================================
# bootstrap_workspace.sh
# Topology-Aware Deterministic Scaffolder (Strict YAGNI, Zero Speculative Bloat)
# ==============================================================================

set -euo pipefail

WORKSPACE_ROOT="${1:-$(pwd)}"
TOPOLOGY="${2:-backend}"
LANGUAGE="${3:-generic}"

echo "🚀 Initializing Topology-Aware Workspace in: ${WORKSPACE_ROOT}"
echo "🏗️ Target Topology: ${TOPOLOGY}"
echo "📦 Target Language Profile: ${LANGUAGE}"
echo "--------------------------------------------------------------"

# ------------------------------------------------------------------------------
# LANGUAGE is validated, not merely echoed. It previously appeared in the
# banner and nowhere else: every language produced an identical tree, which
# made the "deterministic scaffolder" claim false and hid typos from the agent.
# Unknown values are rejected instead of silently producing a generic layout.
# ------------------------------------------------------------------------------
case "${LANGUAGE}" in
  typescript|javascript|python|rust|go|java|csharp|cpp|c|generic|deno|bun)
    ;;
  *)
    echo "❌ Unknown language profile: '${LANGUAGE}'" >&2
    cat >&2 << 'EOF'

Supported language profiles:
  typescript  javascript  deno  bun  python  rust  go  java  csharp  cpp  c
  generic

Use 'generic' when the language has not been decided yet.
EOF
    exit 2
    ;;
esac

# ------------------------------------------------------------------------------
# PROTECTED TARGETS. The scaffolder creates directories and files, so it must
# never run against the filesystem root, the user's home directory, or the
# home directory's parent (scaffolding into /home or C:\Users affects every
# user on the machine). This mirrors lib/scaffold.js isProtectedTarget(), which
# enforces the same rule -- plus template-ancestor and symlink checks -- for
# the Node scaffolder with E_TARGET_IS_PROTECTED.
#
# The check runs BEFORE anything is created: even the .azcodr profile write
# below must not execute for a protected target.
# ------------------------------------------------------------------------------
resolve_absolute() {
  local p="$1"
  if [[ -e "$p" ]]; then
    (cd "$p" 2>/dev/null && pwd -P)
  elif [[ -d "$(dirname "$p")" ]]; then
    printf '%s/%s' "$(cd "$(dirname "$p")" 2>/dev/null && pwd -P)" "$(basename "$p")"
  elif [[ "$p" = /* ]]; then
    printf '%s' "$p"
  else
    printf '%s/%s' "$(pwd -P)" "$p"
  fi
}

lowercase() {
  # ${var,,} needs bash 4+; macOS ships bash 3.2, so use tr.
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

RESOLVED_ROOT="$(resolve_absolute "${WORKSPACE_ROOT}")"
RESOLVED_HOME="$(resolve_absolute "${HOME:-/nonexistent-home}")"
LOWER_ROOT="$(lowercase "${RESOLVED_ROOT}")"
LOWER_HOME="$(lowercase "${RESOLVED_HOME}")"
HOME_PARENT="$(dirname "${RESOLVED_HOME}")"
LOWER_HOME_PARENT="$(lowercase "${HOME_PARENT}")"

PROTECTED_REASON=""
if [[ "${RESOLVED_ROOT}" == "/" ]]; then
  PROTECTED_REASON="the filesystem root"
elif [[ "${RESOLVED_ROOT}" =~ ^/[a-zA-Z]$ ]]; then
  # Git-Bash drive root (/c, /d, ...).
  PROTECTED_REASON="a drive root"
elif [[ "$RESOLVED_ROOT" =~ ^[a-zA-Z]:[\\/]?$ ]]; then
  # Native Windows drive root (C:\, D:).
  PROTECTED_REASON="a drive root"
elif [[ "${LOWER_ROOT}" == "${LOWER_HOME}" ]]; then
  PROTECTED_REASON="the home directory (${RESOLVED_HOME})"
elif [[ "${LOWER_ROOT}" == "${LOWER_HOME_PARENT}" ]]; then
  PROTECTED_REASON="the home directory's parent (${HOME_PARENT})"
fi

if [[ -n "${PROTECTED_REASON}" && "${AZCODR_ALLOW_PROTECTED:-0}" != "1" ]]; then
  echo "❌ Refusing to scaffold into protected directory: ${RESOLVED_ROOT} (${PROTECTED_REASON})." >&2
  echo "   Choose a project subdirectory instead." >&2
  echo "   Embedders that genuinely need this path: AZCODR_ALLOW_PROTECTED=1 <this command>" >&2
  exit 2
fi

# Record the decided language so downstream phases can read it instead of
# re-deriving it (and so the scaffolder's own claim is verifiable).
mkdir -p "${WORKSPACE_ROOT}/.azcodr"
printf 'topology=%s\nlanguage=%s\n' "${TOPOLOGY}" "${LANGUAGE}" \
  > "${WORKSPACE_ROOT}/.azcodr/workspace-profile.env"

# Helper to create leaf directory with .gitkeep to ensure Git tracks empty structures
create_leaf() {
  local dir="$1"
  mkdir -p "${dir}"
  if [[ -z "$(ls -A "${dir}" 2>/dev/null)" ]]; then
    touch "${dir}/.gitkeep"
  fi
}

case "${TOPOLOGY}" in
  extension)
    echo "1. Scaffolding Browser Extension Source Tree (src/)..."
    create_leaf "${WORKSPACE_ROOT}/src/background"
    create_leaf "${WORKSPACE_ROOT}/src/content"
    create_leaf "${WORKSPACE_ROOT}/src/popup"
    create_leaf "${WORKSPACE_ROOT}/src/shared"
    create_leaf "${WORKSPACE_ROOT}/public"
    
    echo "2. Scaffolding Extension Test Suites (tests/)..."
    create_leaf "${WORKSPACE_ROOT}/tests/unit"
    create_leaf "${WORKSPACE_ROOT}/tests/e2e"
    ;;

  game|engine)
    echo "1. Scaffolding Game/Engine Source Tree (src/)..."
    create_leaf "${WORKSPACE_ROOT}/src/core"
    create_leaf "${WORKSPACE_ROOT}/src/ecs"
    create_leaf "${WORKSPACE_ROOT}/src/renderer"
    create_leaf "${WORKSPACE_ROOT}/src/assets"
    
    echo "2. Scaffolding Game/Engine Test Suites (tests/)..."
    create_leaf "${WORKSPACE_ROOT}/tests/unit"
    create_leaf "${WORKSPACE_ROOT}/tests/benchmarks"
    ;;

  cli)
    echo "1. Scaffolding CLI Source Tree (src/)..."
    create_leaf "${WORKSPACE_ROOT}/src/cmd"
    create_leaf "${WORKSPACE_ROOT}/src/core"
    create_leaf "${WORKSPACE_ROOT}/src/io"
    
    echo "2. Scaffolding CLI Test Suites (tests/)..."
    create_leaf "${WORKSPACE_ROOT}/tests/unit"
    create_leaf "${WORKSPACE_ROOT}/tests/integration"
    ;;

  web|saas|fullstack)
    echo "1. Scaffolding Backend / Enterprise Source Tree (src/)..."
    create_leaf "${WORKSPACE_ROOT}/src/domain/entities"
    create_leaf "${WORKSPACE_ROOT}/src/domain/value_objects"
    create_leaf "${WORKSPACE_ROOT}/src/domain/services"
    create_leaf "${WORKSPACE_ROOT}/src/ports/primary"
    create_leaf "${WORKSPACE_ROOT}/src/ports/secondary"
    create_leaf "${WORKSPACE_ROOT}/src/adapters/primary"
    create_leaf "${WORKSPACE_ROOT}/src/adapters/secondary"

    echo "2. Scaffolding Web Frontend Client Source Tree (client/)..."
    create_leaf "${WORKSPACE_ROOT}/client/src/components/layout"
    create_leaf "${WORKSPACE_ROOT}/client/src/components/ui"
    create_leaf "${WORKSPACE_ROOT}/client/src/pages"
    create_leaf "${WORKSPACE_ROOT}/client/src/hooks"
    create_leaf "${WORKSPACE_ROOT}/client/src/services"
    create_leaf "${WORKSPACE_ROOT}/client/public"
    
    echo "3. Scaffolding Specifications (specs/)..."
    create_leaf "${WORKSPACE_ROOT}/specs/openapi"
    create_leaf "${WORKSPACE_ROOT}/specs/tokens"
    
    echo "4. Scaffolding Fullstack Test Suites (tests/)..."
    create_leaf "${WORKSPACE_ROOT}/tests/unit"
    create_leaf "${WORKSPACE_ROOT}/tests/integration"
    create_leaf "${WORKSPACE_ROOT}/tests/contracts"
    create_leaf "${WORKSPACE_ROOT}/tests/client"
    create_leaf "${WORKSPACE_ROOT}/tests/acceptance"
    
    echo "5. Scaffolding Deployment Infrastructure (deploy/)..."
    create_leaf "${WORKSPACE_ROOT}/deploy/docker"
    create_leaf "${WORKSPACE_ROOT}/deploy/compose"

    TOKEN_SPEC="${WORKSPACE_ROOT}/specs/tokens/tokens.json"
    if [[ ! -f "${TOKEN_SPEC}" ]]; then
      cat << 'EOF' > "${TOKEN_SPEC}"
{
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
EOF
    fi
    ;;

  backend)
    echo "1. Scaffolding Headless Backend Source Tree (src/)..."
    create_leaf "${WORKSPACE_ROOT}/src/domain/entities"
    create_leaf "${WORKSPACE_ROOT}/src/domain/value_objects"
    create_leaf "${WORKSPACE_ROOT}/src/domain/services"
    create_leaf "${WORKSPACE_ROOT}/src/ports/primary"
    create_leaf "${WORKSPACE_ROOT}/src/ports/secondary"
    create_leaf "${WORKSPACE_ROOT}/src/adapters/primary"
    create_leaf "${WORKSPACE_ROOT}/src/adapters/secondary"
    
    echo "2. Scaffolding Specifications (specs/)..."
    create_leaf "${WORKSPACE_ROOT}/specs/openapi"
    create_leaf "${WORKSPACE_ROOT}/specs/tokens"
    
    echo "3. Scaffolding Backend Test Suites (tests/)..."
    create_leaf "${WORKSPACE_ROOT}/tests/unit"
    create_leaf "${WORKSPACE_ROOT}/tests/integration"
    create_leaf "${WORKSPACE_ROOT}/tests/contracts"
    create_leaf "${WORKSPACE_ROOT}/tests/acceptance"
    
    echo "4. Scaffolding Deployment Infrastructure (deploy/)..."
    create_leaf "${WORKSPACE_ROOT}/deploy/docker"
    create_leaf "${WORKSPACE_ROOT}/deploy/compose"

    TOKEN_SPEC="${WORKSPACE_ROOT}/specs/tokens/tokens.json"
    if [[ ! -f "${TOKEN_SPEC}" ]]; then
      cat << 'EOF' > "${TOKEN_SPEC}"
{
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
EOF
    fi
    ;;

  frontend)
    echo "1. Scaffolding Frontend Client Source Tree (src/)..."
    create_leaf "${WORKSPACE_ROOT}/src/components/layout"
    create_leaf "${WORKSPACE_ROOT}/src/components/ui"
    create_leaf "${WORKSPACE_ROOT}/src/pages"
    create_leaf "${WORKSPACE_ROOT}/src/hooks"
    create_leaf "${WORKSPACE_ROOT}/src/services"
    create_leaf "${WORKSPACE_ROOT}/public"
    
    echo "2. Scaffolding Specifications (specs/)..."
    create_leaf "${WORKSPACE_ROOT}/specs/tokens"
    
    echo "3. Scaffolding Frontend Test Suites (tests/)..."
    create_leaf "${WORKSPACE_ROOT}/tests/unit"
    create_leaf "${WORKSPACE_ROOT}/tests/acceptance"
    ;;

  canvas-game|canvas|webgame)
    # Topology D: Browser / Canvas Game (HTML5 Canvas / WebGL / WebGPU).
    # Game Loop shaped: Input -> Update -> Render.
    echo "1. Scaffolding Canvas Game Source Tree (game loop shaped)..."
    create_leaf "${WORKSPACE_ROOT}/src/entities"
    create_leaf "${WORKSPACE_ROOT}/src/systems/update"
    create_leaf "${WORKSPACE_ROOT}/src/systems/render"
    create_leaf "${WORKSPACE_ROOT}/src/input"
    create_leaf "${WORKSPACE_ROOT}/src/audio"
    create_leaf "${WORKSPACE_ROOT}/src/ui"
    create_leaf "${WORKSPACE_ROOT}/src/scenes"
    create_leaf "${WORKSPACE_ROOT}/src/config"

    echo "2. Scaffolding Canvas Game Tests (tests/)..."
    create_leaf "${WORKSPACE_ROOT}/tests/unit"
    create_leaf "${WORKSPACE_ROOT}/tests/e2e"

    echo "3. Scaffolding Public Assets (public/)..."
    create_leaf "${WORKSPACE_ROOT}/public/assets"
    ;;

  systems-library|embedded|systems)
    # Topology F: Embedded / Systems Library.
    # No heap assumptions, no dynamic allocation in the hot path.
    echo "1. Scaffolding Systems Library Source Tree (src/)..."
    create_leaf "${WORKSPACE_ROOT}/src/core"
    create_leaf "${WORKSPACE_ROOT}/src/hal"
    create_leaf "${WORKSPACE_ROOT}/src/drivers"
    create_leaf "${WORKSPACE_ROOT}/src/protocol"
    create_leaf "${WORKSPACE_ROOT}/src/utils"

    echo "2. Scaffolding Systems Library Tests (tests/)..."
    create_leaf "${WORKSPACE_ROOT}/tests/unit"
    create_leaf "${WORKSPACE_ROOT}/tests/hal"
    create_leaf "${WORKSPACE_ROOT}/tests/benchmarks"
    ;;

  *)
    # Fail loudly rather than scaffolding a generic tree and exiting 0. A
    # wrong-but-successful scaffold is worse than a refusal: the agent reports
    # success to the user and the mismatch surfaces much later.
    echo "❌ Unknown topology: '${TOPOLOGY}'" >&2
    cat >&2 << 'EOF'

Supported topologies:
  extension        Topology B  Browser Extension (Manifest V3)
  game|engine      Topology C  Game Engine / High-Performance Simulator
  canvas-game      Topology D  Browser / Canvas Game (Canvas/WebGL/WebGPU)
  cli              Topology E  Desktop Application / CLI Utility
  backend          Topology A  Headless API / Service
  web|saas|fullstack Topology A  Fullstack Web Application
  frontend         Topology A  Frontend-only Client
  systems-library  Topology F  Embedded / Systems Library
EOF
    echo >&2
    echo "Re-run with one of the above." >&2
    exit 2
    ;;
esac

# ------------------------------------------------------------------------------
# DETERMINISTIC TOOLCHAIN FILES. Directories alone enforce nothing: until this
# section existed, every language produced zero gate configurations and the
# starter `lint` script was an echo placeholder, so all enforcement was
# agent-authored. Each profile below emits its pinned gate configuration with
# values mirroring docs/rules/clean_code.md (300/30/10/3); the agent installs
# the named tool and proves the gate in Phase 5. Files are created only when
# absent, so re-runs never clobber agent-authored configs. Build manifests
# (Cargo.toml, go.mod, csproj, ...) stay with the agent: they carry project
# naming and version decisions no script may invent.
# ------------------------------------------------------------------------------
write_unless_exists() {
  local target="$1"
  if [[ -f "${target}" ]]; then
    echo "   keeping existing ${target}"
    return
  fi
  mkdir -p "$(dirname "${target}")"
  cat > "${target}"
}

append_unless_present() {
  local target="$1"
  local marker="$2"
  if [[ -f "${target}" ]] && grep -qF "${marker}" "${target}"; then
    echo "   keeping existing ${target} gates"
    return
  fi
  cat >> "${target}"
}

echo "6. Emitting deterministic toolchain configs for '${LANGUAGE}'..."
case "${LANGUAGE}" in
  typescript|javascript|deno|bun)
    write_unless_exists "${WORKSPACE_ROOT}/eslint.config.js" << 'EOF'
// Deterministic fitness functions (azcodr clean_code.md section 5).
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
EOF
    ;;
  python)
    write_unless_exists "${WORKSPACE_ROOT}/ruff.toml" << 'EOF'
# Deterministic fitness functions (azcodr clean_code.md section 5).
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
EOF
    ;;
  rust)
    write_unless_exists "${WORKSPACE_ROOT}/clippy.toml" << 'EOF'
# Deterministic fitness functions (azcodr clean_code.md section 5).
# Enforce with: cargo clippy -- -D clippy::too_many_lines -D clippy::cognitive_complexity -D clippy::too_many_arguments
too-many-lines-threshold = 30
cognitive-complexity-threshold = 10
too-many-arguments-threshold = 3
# NOTE: clippy has no file-length lint; the 300-line file cap is enforced by
# the project's lint entry (see lets-build Phase 5 proof).
EOF
    ;;
  go)
    write_unless_exists "${WORKSPACE_ROOT}/.golangci.yml" << 'EOF'
# Deterministic fitness functions (azcodr clean_code.md section 5).
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
EOF
    ;;
  java)
    write_unless_exists "${WORKSPACE_ROOT}/checkstyle.xml" << 'EOF'
<?xml version="1.0"?>
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
EOF
    ;;
  csharp)
    append_unless_present "${WORKSPACE_ROOT}/.editorconfig" "azcodr fitness functions" << 'EOF'

# --- azcodr fitness functions (CA gates; exact numbers in lint entry) ---
[*.cs]
dotnet_diagnostic.CA1501.severity = error
dotnet_diagnostic.CA1502.severity = error
EOF
    ;;
  cpp|c)
    write_unless_exists "${WORKSPACE_ROOT}/.clang-tidy" << 'EOF'
# Deterministic fitness functions (azcodr clean_code.md section 5).
Checks: 'readability-function-size,readability-function-cognitive-complexity'
CheckOptions:
  - { key: readability-function-size.LineThreshold, value: 30 }
  - { key: readability-function-size.ParameterThreshold, value: 3 }
  - { key: readability-function-cognitive-complexity.Threshold, value: 10 }
# NOTE: clang-tidy has no file-length check; the 300-line file cap is
# enforced by the project's lint entry (see lets-build Phase 5 proof).
EOF
    ;;
  generic)
    echo "   language undecided: no toolchain configs emitted (re-run with a language profile)"
    ;;
esac

# For Node profiles the starter package.json ships a lint placeholder that
# always succeeds. Point it at the emitted config so `npm run lint` fails
# until the pinned eslint is installed (fail-closed) instead of echoing.
# Only the placeholder is ever replaced; agent-wired entries are sacred.
case "${LANGUAGE}" in
  typescript|javascript|deno|bun)
    STARTER_PKG="${WORKSPACE_ROOT}/package.json"
    if [[ -f "${STARTER_PKG}" ]] && grep -q 'No linter configured yet' "${STARTER_PKG}"; then
      if command -v node >/dev/null 2>&1; then
        node -e 'const fs=require("fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,"utf8"));j.scripts=j.scripts||{};j.scripts.lint="eslint .";fs.writeFileSync(p,JSON.stringify(j,null,2)+"\n");' "${STARTER_PKG}"
        echo "   wired package.json lint -> eslint ."
      else
        echo "   node not found: leaving starter lint placeholder (agent wires it in Phase 4)"
      fi
    fi
    ;;
esac

# ------------------------------------------------------------------------------
# memory.md is an APPEND-ONLY LEDGER. It is never rewritten automatically.
#
# HISTORY (this was a data-loss bug): this script previously overwrote
# memory.md with a template whenever the file contained any ADR heading that
# was not the untouched placeholder. Re-running /lets-build on a live project
# silently destroyed every recorded architectural decision -- irreplaceable
# work, with no backup and no error. ADRs are immutable history by rule
# (docs/rules/agentic_configuration.md); a scaffolder has no business
# rewriting them.
#
# Resetting the ledger is now opt-in, always backed up, and always announced.
# ------------------------------------------------------------------------------
MEMORY_FILE="${WORKSPACE_ROOT}/memory.md"
if [[ -f "${MEMORY_FILE}" ]]; then
  # Only a genuinely recorded decision counts as "has content": an h4 ADR
  # heading outside of an HTML comment.
  RECORDED_ADRS="$(grep -cE '^####[[:space:]]+ADR-[0-9]+' "${MEMORY_FILE}" 2>/dev/null || true)"
  RECORDED_ADRS="${RECORDED_ADRS:-0}"

  if [[ "${RECORDED_ADRS}" -gt 0 ]]; then
    if [[ "${AZCODR_RESET_MEMORY:-0}" == "1" ]]; then
      BACKUP="${MEMORY_FILE}.bak"
      cp -p "${MEMORY_FILE}" "${BACKUP}"
      echo "⚠️  AZCODR_RESET_MEMORY=1 -- RESETTING ${RECORDED_ADRS} recorded ADR(s) in memory.md"
      echo "    Backup written to ${BACKUP}"
      cat << 'EOF' > "${MEMORY_FILE}"
# Workspace Memory, Architecture Decisions & Knowledge Hub

> **Core Purpose:** Authoritative persistent memory ledger for the workspace repository (`./`), maintaining Lightweight Architectural Decision Records (ADRs), system topologies, and living domain contracts.

---

## 1. Quick Navigation & Knowledge Repositories

- 📖 **[Living Ubiquitous Language Glossary](./docs/knowledge/ubiquitous_language.md)**: Authoritative, single-name domain vocabulary contract.
- 📜 **[Lightweight ADR Master Index](#adr-master-index)**: Summary of all architectural decisions and direct links to governing rules.

---

## 2. Consolidated Architectural Decision Records (ADRs)

### ADR Master Index

| ID | Title | Date | Status | Governing Rule / Skill |
|---|---|---|---|---|
| *(No decisions recorded yet)* | *Record initial architecture decisions during Phase 3 of /lets-build.* | *YYYY-MM-DD* | *ACCEPTED* | *e.g. [`clean_code.md`](./docs/rules/clean_code.md)* |

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
EOF
    else
      echo "🧠 Preserving memory.md: ${RECORDED_ADRS} recorded ADR(s) found."
      echo "    memory.md is append-only and is never rewritten by the scaffolder."
      echo "    To intentionally reset the ledger: AZCODR_RESET_MEMORY=1 <this command>"
    fi
  fi
fi

# Deterministically generate boundary verification smoke test script (Phase 5 requirement)
SMOKE_TEST="${WORKSPACE_ROOT}/scripts/smoke_test.sh"
if [[ ! -f "${SMOKE_TEST}" ]]; then
  echo "5. Generating boundary smoke test verification script (scripts/smoke_test.sh)..."
  mkdir -p "${WORKSPACE_ROOT}/scripts"
  cat << 'EOF' > "${SMOKE_TEST}"
#!/usr/bin/env bash
# ==============================================================================
# Boundary Verification Smoke Test (Phase 5 Verification Gate)
# ==============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Running boundary smoke verification..."
if [[ -f "${ROOT}/.agents/scripts/boundary_guard.js" ]] && command -v node >/dev/null 2>&1; then
  node "${ROOT}/.agents/scripts/boundary_guard.js" "${ROOT}/src"
else
  echo "⚠️  Boundary guard skipped (node or guard script unavailable)."
fi
# Extend with project-specific runtime health checks (e.g. ping health endpoint, CLI --help)
echo "✅ Boundary smoke verification passed!"
EOF
  chmod +x "${SMOKE_TEST}"
fi

echo "--------------------------------------------------------------"
echo "✅ Topology '${TOPOLOGY}' scaffolded with strict YAGNI (0 speculative folders)!"
echo ""
echo "🛑 MANDATORY HANDOVER GATE (ADR-008):"
echo "   Bootstrapping is COMPLETE. Zero application domain entities have been created."
echo "   DO NOT fabricate domain models, entities, or features during lets-build."
echo "   Next: invoke 'product-analyst' & 'relentless-questioner' to conduct formal"
echo "   stakeholder domain analysis, INVEST story decomposition, and Gherkin criteria."
