#!/usr/bin/env bash
# ==============================================================================
# validate_agentic_configs.sh
# Deterministic Validator for Agentic Files, Rules, and Skills
# ==============================================================================

set -euo pipefail

WORKSPACE_ROOT=""
FIX_MODE=false

for arg in "$@"; do
  if [[ "${arg}" == "--fix" ]]; then
    FIX_MODE=true
  elif [[ -z "${WORKSPACE_ROOT}" ]]; then
    WORKSPACE_ROOT="${arg}"
  fi
done

if [[ -z "${WORKSPACE_ROOT}" ]]; then
  WORKSPACE_ROOT="$(pwd)"
fi

ERRORS=0
WARNINGS=0

echo "🔍 Validating Agentic Architecture in: ${WORKSPACE_ROOT}"
echo "--------------------------------------------------------------"

# Helper print functions
log_pass() { echo "  ✅ $1"; }
log_warn() { echo "  ⚠️  $1"; WARNINGS=$((WARNINGS + 1)); }
log_fail() { echo "  ❌ $1"; ERRORS=$((ERRORS + 1)); }

# 1. Root AGENTS.md & Symlinks Verification
echo "1. Checking Root Configuration & Symlinks..."
AGENTS_FILE="${WORKSPACE_ROOT}/AGENTS.md"
if [[ ! -f "${AGENTS_FILE}" ]]; then
  log_fail "Missing root AGENTS.md at ${AGENTS_FILE}"
else
  log_pass "AGENTS.md exists."
  
  LINE_COUNT=$(wc -l < "${AGENTS_FILE}")
  if [[ ${LINE_COUNT} -le 120 ]]; then
    log_pass "AGENTS.md line count is lean: ${LINE_COUNT} lines (<= 120)."
  elif [[ ${LINE_COUNT} -le 150 ]]; then
    log_warn "AGENTS.md line count is getting large: ${LINE_COUNT} lines (warn > 120)."
  else
    log_fail "AGENTS.md exceeds maximum line limit: ${LINE_COUNT} lines (max 150)."
  fi
fi

# Helper to check if symlink target resolves to AGENTS.md
is_valid_agents_target() {
  local target="$1"
  [[ "${target}" == "AGENTS.md" || "${target}" == "./AGENTS.md" || "${target}" == "${WORKSPACE_ROOT}/AGENTS.md" ]]
}

is_valid_text_pointer() {
  local file="$1"
  local content
  content=$(< "${file}")
  [[ "${content}" == "AGENTS.md" || "${content}" == "./AGENTS.md" || "${content}" == "${WORKSPACE_ROOT}/AGENTS.md" ]]
}

is_identical_copy() {
  local file="$1"
  [[ -f "${file}" ]] && [[ -f "${AGENTS_FILE}" ]] && cmp -s "${file}" "${AGENTS_FILE}"
}

# Check CLAUDE.md symlink
CLAUDE_FILE="${WORKSPACE_ROOT}/CLAUDE.md"
if [[ -L "${CLAUDE_FILE}" ]]; then
  TARGET=$(readlink "${CLAUDE_FILE}")
  if is_valid_agents_target "${TARGET}"; then
    log_pass "CLAUDE.md is a valid symlink to AGENTS.md."
  else
    log_fail "CLAUDE.md points to '${TARGET}' instead of 'AGENTS.md'."
  fi
elif [[ -f "${CLAUDE_FILE}" ]] && is_valid_text_pointer "${CLAUDE_FILE}"; then
  log_pass "CLAUDE.md is a text pointer to AGENTS.md (symlink fallback)."
elif is_identical_copy "${CLAUDE_FILE}"; then
  log_warn "CLAUDE.md is a byte-identical copy of AGENTS.md (Windows symlink fallback; drift risk)."
else
  log_fail "CLAUDE.md is not a symbolic link."
fi

# Check agents.md symlink (case-insensitive filesystem aware)
AGENTS_LOWER="${WORKSPACE_ROOT}/agents.md"
IS_CASE_INSENSITIVE=false
if [[ "$(uname -s)" == "Darwin" ]] || [[ "$(uname -s)" =~ (MINGW|MSYS|CYGWIN) ]] || [[ "${OS:-}" == "Windows_NT" ]]; then
  IS_CASE_INSENSITIVE=true
elif [[ -f "${AGENTS_FILE}" ]] && [[ -f "${AGENTS_LOWER}" ]] && [[ ! -L "${AGENTS_LOWER}" ]]; then
  IS_CASE_INSENSITIVE=true
fi

if [[ "${IS_CASE_INSENSITIVE}" == "true" ]]; then
  log_pass "agents.md is satisfied natively by AGENTS.md (case-insensitive filesystem)."
else
  if [[ ! -L "${AGENTS_LOWER}" ]] && [[ ! -e "${AGENTS_LOWER}" ]] && [[ -f "${AGENTS_FILE}" ]]; then
    ln -sf "AGENTS.md" "${AGENTS_LOWER}"
    log_pass "Created agents.md symlink to AGENTS.md (case-sensitive filesystem parity)."
  fi
  if [[ -L "${AGENTS_LOWER}" ]]; then
    TARGET=$(readlink "${AGENTS_LOWER}")
    if is_valid_agents_target "${TARGET}"; then
      log_pass "agents.md is a valid symlink to AGENTS.md."
    else
      log_fail "agents.md points to '${TARGET}' instead of 'AGENTS.md'."
    fi
  elif [[ -f "${AGENTS_LOWER}" ]] && is_valid_text_pointer "${AGENTS_LOWER}"; then
    log_pass "agents.md is a text pointer to AGENTS.md (symlink fallback)."
  elif is_identical_copy "${AGENTS_LOWER}"; then
    log_warn "agents.md is a byte-identical copy of AGENTS.md (Windows symlink fallback; drift risk)."
  else
    log_fail "agents.md is not a symbolic link."
  fi
fi

# Check GEMINI.md symlink
GEMINI_FILE="${WORKSPACE_ROOT}/GEMINI.md"
if [[ -L "${GEMINI_FILE}" ]]; then
  TARGET=$(readlink "${GEMINI_FILE}")
  if is_valid_agents_target "${TARGET}"; then
    log_pass "GEMINI.md is a valid symlink to AGENTS.md."
  else
    log_fail "GEMINI.md points to '${TARGET}' instead of 'AGENTS.md'."
  fi
elif [[ -f "${GEMINI_FILE}" ]] && is_valid_text_pointer "${GEMINI_FILE}"; then
  log_pass "GEMINI.md is a text pointer to AGENTS.md (symlink fallback)."
elif is_identical_copy "${GEMINI_FILE}"; then
  log_warn "GEMINI.md is a byte-identical copy of AGENTS.md (Windows symlink fallback; drift risk)."
else
  log_fail "GEMINI.md is not a symbolic link."
fi

# Check .cursorrules symlink
CURSOR_FILE="${WORKSPACE_ROOT}/.cursorrules"
if [[ -L "${CURSOR_FILE}" ]]; then
  TARGET=$(readlink "${CURSOR_FILE}")
  if is_valid_agents_target "${TARGET}"; then
    log_pass ".cursorrules is a valid symlink to AGENTS.md."
  else
    log_fail ".cursorrules points to '${TARGET}' instead of 'AGENTS.md'."
  fi
elif [[ -f "${CURSOR_FILE}" ]] && is_valid_text_pointer "${CURSOR_FILE}"; then
  log_pass ".cursorrules is a text pointer to AGENTS.md (symlink fallback)."
elif is_identical_copy "${CURSOR_FILE}"; then
  log_warn ".cursorrules is a byte-identical copy of AGENTS.md (Windows symlink fallback; drift risk)."
else
  log_fail ".cursorrules is not a symbolic link."
fi

# Check .windsurfrules symlink
WINDSURF_FILE="${WORKSPACE_ROOT}/.windsurfrules"
if [[ -L "${WINDSURF_FILE}" ]]; then
  TARGET=$(readlink "${WINDSURF_FILE}")
  if is_valid_agents_target "${TARGET}"; then
    log_pass ".windsurfrules is a valid symlink to AGENTS.md."
  else
    log_fail ".windsurfrules points to '${TARGET}' instead of 'AGENTS.md'."
  fi
elif [[ -f "${WINDSURF_FILE}" ]] && is_valid_text_pointer "${WINDSURF_FILE}"; then
  log_pass ".windsurfrules is a text pointer to AGENTS.md (symlink fallback)."
elif is_identical_copy "${WINDSURF_FILE}"; then
  log_warn ".windsurfrules is a byte-identical copy of AGENTS.md (Windows symlink fallback; drift risk)."
else
  log_fail ".windsurfrules is not a symbolic link."
fi

# Check .github/copilot-instructions.md symlink (if .github directory exists)
COPILOT_FILE="${WORKSPACE_ROOT}/.github/copilot-instructions.md"
if [[ -d "${WORKSPACE_ROOT}/.github" ]]; then
  if [[ -L "${COPILOT_FILE}" ]]; then
    TARGET=$(readlink "${COPILOT_FILE}")
    TARGET="${TARGET//\\//}"
    if [[ "${TARGET}" == "../AGENTS.md" || "${TARGET}" == "${WORKSPACE_ROOT}/AGENTS.md" || "${TARGET}" == "AGENTS.md" ]]; then
      log_pass ".github/copilot-instructions.md is a valid symlink to AGENTS.md."
    else
      log_fail ".github/copilot-instructions.md points to '${TARGET}' instead of '../AGENTS.md'."
    fi
  elif [[ -f "${COPILOT_FILE}" ]] && [[ "$(< "${COPILOT_FILE}")" == *"AGENTS.md"* ]]; then
    log_pass ".github/copilot-instructions.md references AGENTS.md (symlink fallback)."
  elif [[ -f "${COPILOT_FILE}" ]]; then
    log_warn ".github/copilot-instructions.md exists but is neither a symlink to ../AGENTS.md nor references AGENTS.md."
  fi
fi

# Check .gitignore exists
GITIGNORE_FILE="${WORKSPACE_ROOT}/.gitignore"
if [[ -f "${GITIGNORE_FILE}" ]]; then
  log_pass ".gitignore exists."
else
  log_fail "Missing .gitignore at ${GITIGNORE_FILE}"
fi

# Check .github/workflows exists (CI must propagate to scaffolded projects)
if [[ -d "${WORKSPACE_ROOT}/.github/workflows" ]]; then
  log_pass ".github/workflows exists."
else
  log_warn ".github/workflows is missing (CI will not run in scaffolded projects)."
fi

# 2. Checking Progressive Disclosure Rules (docs/rules)
echo ""
echo "2. Checking Progressive Disclosure Rules..."
RULES_DIR="${WORKSPACE_ROOT}/docs/rules"
if [[ ! -d "${RULES_DIR}" ]]; then
  log_fail "Missing docs/rules directory at ${RULES_DIR}"
else
  RULE_COUNT=0
  for rule_file in "${RULES_DIR}"/*.md; do
    [[ -e "${rule_file}" ]] || continue
    RULE_COUNT=$((RULE_COUNT + 1))
    RULE_NAME=$(basename "${rule_file}")

    # Check for title
    if ! grep -q "^# " "${rule_file}"; then
      log_fail "Rule ${RULE_NAME} missing H1 header (# Title)"
    fi

    # Check for Core Mandate blockquote
    if ! grep -q "^> \*\*Core Mandate:\*\*" "${rule_file}"; then
      log_warn "Rule ${RULE_NAME} missing standardized '> **Core Mandate:**' summary"
    fi

    # Token-economy size cap (24KB)
    RULE_SIZE=$(wc -c < "${rule_file}")
    if [[ ${RULE_SIZE} -gt 24000 ]]; then
      log_warn "Rule ${RULE_NAME} exceeds 24KB token-economy cap (${RULE_SIZE} bytes)"
    fi
  done
  log_pass "Validated ${RULE_COUNT} modular rule files in docs/rules/."
fi

# 3. Checking Skills Architecture (.agents/skills)
echo ""
echo "3. Checking Specialized Skills (.agents/skills)..."
SKILLS_DIR="${WORKSPACE_ROOT}/.agents/skills"
if [[ ! -d "${SKILLS_DIR}" ]]; then
  log_fail "Missing .agents/skills directory at ${SKILLS_DIR}"
else
  SKILL_COUNT=0
  for skill_folder in "${SKILLS_DIR}"/*; do
    [[ -d "${skill_folder}" ]] || continue
    SKILL_NAME=$(basename "${skill_folder}")
    SKILL_FILE="${skill_folder}/SKILL.md"
    SKILL_COUNT=$((SKILL_COUNT + 1))
    
    if [[ ! -f "${SKILL_FILE}" ]]; then
      log_fail "Skill '${SKILL_NAME}' missing SKILL.md"
      continue
    fi
    
    # Check front matter existence
    if ! head -n 1 "${SKILL_FILE}" | grep -q "^---"; then
      log_fail "Skill '${SKILL_NAME}' missing opening front matter delimiter (---)"
      continue
    fi

    # Check closing front matter delimiter
    if ! awk 'NR > 1 && /^---[[:space:]]*$/ { found=1; exit } END { exit !found }' "${SKILL_FILE}"; then
      log_fail "Skill '${SKILL_NAME}' missing closing front matter delimiter (---)"
    fi
    
    # Check name field in front matter
    if ! grep -E "^name:[[:space:]]*${SKILL_NAME}" "${SKILL_FILE}" > /dev/null; then
      log_fail "Skill '${SKILL_NAME}' front matter 'name:' does not match directory name"
    fi
    
    # Check description
    DESC=$(grep -E "^description:" "${SKILL_FILE}" | sed -E 's/^description:[[:space:]]*//' || true)
    if [[ -z "${DESC}" ]]; then
      log_fail "Skill '${SKILL_NAME}' missing front matter 'description:'"
    else
      # Check imperative phrasing
      if [[ ! "${DESC}" =~ ^Use[[:space:]]when ]]; then
        log_warn "Skill '${SKILL_NAME}' description should start with imperative 'Use when...'"
      fi

      # Check negative boundary phrasing (Do not use / Do NOT use)
      if ! echo "${DESC}" | grep -qiE "(do not use|do NOT use)"; then
        log_warn "Skill '${SKILL_NAME}' description should specify negative boundaries ('Do not use for...')"
      fi
      
      # Check character length (< 1024)
      CHAR_LEN=${#DESC}
      if [[ ${CHAR_LEN} -gt 1024 ]]; then
        log_fail "Skill '${SKILL_NAME}' description exceeds 1024 chars (${CHAR_LEN} chars)"
      fi
    fi
    
    # Check body length (< 500 lines)
    SKILL_LINES=$(wc -l < "${SKILL_FILE}")
    if [[ ${SKILL_LINES} -gt 500 ]]; then
      log_warn "Skill '${SKILL_NAME}' exceeds 500 lines (${SKILL_LINES} lines). Offload details to references/."
    else
      log_pass "Skill '${SKILL_NAME}': ${SKILL_LINES} lines, description valid (${#DESC} chars)."
    fi
    
    # Check for Gotchas / What NOT to do section
    if ! grep -qi "What NOT to do" "${SKILL_FILE}" && ! grep -qi "Gotchas" "${SKILL_FILE}"; then
      log_warn "Skill '${SKILL_NAME}' missing mandatory 'Gotchas & What NOT to Do' section"
    fi
  done
  log_pass "Validated ${SKILL_COUNT} skills in .agents/skills/."
fi

# 4. Checking Markdown Internal Links & Cross-References
echo ""
echo "4. Checking Markdown Internal Links & Cross-References..."
LINK_CHECK_RAW=$(node -e '
const fs = require("fs");
const path = require("path");

const root = process.argv[1];
const broken = [];
let totalLinks = 0;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      checkFile(full);
    }
  }
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const dir = path.dirname(filePath);
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const target = match[2].trim();
    if (target.startsWith("http://") || target.startsWith("https://") || target.startsWith("mailto:") || target.startsWith("#") || target.startsWith("conversation://") || target.startsWith("file://")) {
      continue;
    }
    const cleanTarget = target.split("#")[0];
    if (!cleanTarget) continue;
    totalLinks++;
    const resolved = path.normalize(path.join(dir, cleanTarget));
    if (!fs.existsSync(resolved)) {
      broken.push(`${path.relative(root, filePath)} -> ${target}`);
    }
  }
}

walk(root);
if (broken.length > 0) {
  console.log("BROKEN:" + broken.join("|"));
  process.exit(1);
} else {
  console.log("OK:" + totalLinks);
  process.exit(0);
}
' "${WORKSPACE_ROOT}" 2>&1) || true

if [[ "${LINK_CHECK_RAW}" =~ ^OK:([0-9]+) ]]; then
  TOTAL_LINKS="${BASH_REMATCH[1]}"
  log_pass "Validated ${TOTAL_LINKS} internal links across workspace (0 broken links)."
elif [[ "${LINK_CHECK_RAW}" =~ ^BROKEN:(.*) ]]; then
  BROKEN_LIST="${BASH_REMATCH[1]}"
  IFS='|' read -ra BROKEN_ITEMS <<< "${BROKEN_LIST}"
  for item in "${BROKEN_ITEMS[@]}"; do
    log_fail "Broken markdown link: ${item}"
  done
else
  log_fail "Markdown link validation failed unexpectedly: ${LINK_CHECK_RAW}"
fi

# 5. Checking Memory & ADR Ledger
echo ""
echo "5. Checking Memory & ADR Ledger..."
MEMORY_FILE="${WORKSPACE_ROOT}/memory.md"
if [[ ! -f "${MEMORY_FILE}" ]]; then
  log_fail "Missing memory.md ADR ledger."
else
  MEMORY_BODY=$(sed '/<!--/,/-->/d' "${MEMORY_FILE}")
  if ! grep -q "^# " "${MEMORY_FILE}"; then
    log_fail "memory.md missing H1 header"
  elif echo "${MEMORY_BODY}" | grep -q "#### ADR-"; then
    log_pass "memory.md contains ADR entries with valid envelope."
  else
    log_pass "memory.md is a clean slate (no ADRs yet; record ADR-001 during /lets-build)."
  fi
fi

# 6. Summary Output
echo ""
echo "--------------------------------------------------------------"
if [[ ${ERRORS} -eq 0 ]]; then
  echo "🎉 SUCCESS: All agentic configurations are valid and healthy! (${WARNINGS} warnings)"
  exit 0
else
  echo "🚨 FAILURE: Found ${ERRORS} error(s) and ${WARNINGS} warning(s) in agentic configurations."
  exit 1
fi
