#!/usr/bin/env bash
# =============================================================================
# PreToolUse safety guard.
#
# Blocking is the goal. When the guard cannot determine what it is looking at,
# it permits the action and records why: a guard that fails closed on an
# unparseable payload locks an agent out of its own toolchain, which gets the
# guard switched off entirely. The deterministic, high-severity denylist below
# is the compensating control.
#
# Two input channels are read, because harnesses differ:
#   1. argv  -- `safety_guard.sh 'rm -rf /'`
#   2. stdin -- `echo '{"tool_input":{"command":"rm -rf /"}}' | safety_guard.sh`
# Both are scanned. Neither alone is sufficient.
# =============================================================================
set -uo pipefail

PAYLOAD=""

# --- Channel 1: argv ----------------------------------------------------------
if [ "$#" -gt 0 ]; then
  PAYLOAD="$*"
fi

# --- Channel 2: stdin (JSON tool-call envelope) ------------------------------
# Read with a short timeout so an interactive terminal does not hang the hook.
STDIN_JSON=""
if [ ! -t 0 ]; then
  if command -v timeout >/dev/null 2>&1; then
    STDIN_JSON="$(timeout 2 cat 2>/dev/null || true)"
  else
    STDIN_JSON="$(cat 2>/dev/null || true)"
  fi
fi

if [ -n "$STDIN_JSON" ]; then
  # Flatten the common envelope shapes into a scannable string. We are not
  # executing anything, so crude extraction is acceptable here.
  #
  # Only JSON *structural* characters are removed. Spaces MUST be preserved:
  # stripping them collapses `rm -rf /` into `rm-rf/`, which defeats every
  # pattern below. That bug shipped once; the regression test pins it.
  FLAT="$(printf '%s' "$STDIN_JSON" \
    | tr ',' '\n' \
    | sed -e 's/^[^:]*://' \
    | tr -d '"{}[]' \
    | tr '\n' ' ')"
  if [ -n "$FLAT" ]; then
    PAYLOAD="${PAYLOAD} ${FLAT}"
  fi
fi

if [ -z "$(printf '%s' "$PAYLOAD" | tr -d '[:space:]')" ]; then
  # Nothing inspectable. Permit, and say so, rather than guessing.
  exit 0
fi

# Normalise once: lowercase copy for case-insensitive matching, plus a
# whitespace-collapsed copy so `rm  -rf   /` cannot slip past.
NORMALISED="$(printf '%s' "$PAYLOAD" | tr '[:upper:]' '[:lower:]')"
COLLAPSED="$(printf '%s' "$NORMALISED" | tr '\n\t' '  ' | tr -s ' ')"

block() {
  echo "🚨 Safety Guard: $1" >&2
  echo "   command: ${PAYLOAD:0:300}" >&2
  exit 1
}

# =============================================================================
# Denylist. Each pattern is matched against the normalised payload.
# =============================================================================
check() {
  local pattern="$1"
  local reason="$2"
  if printf '%s' "$COLLAPSED" | grep -Eq -- "$pattern"; then
    block "$reason"
  fi
}

# --- 1. Destructive filesystem deletion --------------------------------------
# Targets: /, /*, ~, $HOME, ., .., and the OS drive roots. `rm -rf .` is the
# single most dangerous omission in the previous version: it annihilates the
# working directory and is strictly worse for a developer than `rm -rf /`.
check 'rm[[:space:]]+(-[a-z-]*[rf][a-z-]*[[:space:]]+)+(/|/\*|~|~/\*|\$home|\$\{home\}|\.|\.\.|\.\/|c:\\\\|c:/|d:\\\\)' \
  "destructive rm targeting root, home, drive, or the current directory"
check '(^|[[:space:]])rm[[:space:]]+(-[a-z-]*[[:space:]]+)*(/|~|c:\\|c:/)($|[[:space:]])' \
  "destructive rm targeting root or home"

# Long-form flag variants that the short-flag class misses.
check 'rm[[:space:]]+--recursive.*--force[[:space:]]+(/|~|\$home|\.)' \
  "destructive rm using long-form flags"
check 'rm[[:space:]].*--no-preserve-root' \
  "rm --no-preserve-root is never appropriate under an agent"

# Whole-tree wipes that are not `rm` at all.
check '(wipefs[[:space:]]+-a|shred[[:space:]]+-u|find[[:space:]].*-delete)' \
  "irreversible disk or mass-delete operation"

# --- 2. Git history / remote destruction -------------------------------------
# The previous pattern required `--force` immediately after `push`, so the most
# natural real invocation -- `git push origin main --force` -- passed.
check 'git[[:space:]]+push.*(-f|--force|--mirror)' \
  "force-push or mirror-push can destroy remote history"
check 'git[[:space:]]+.*--force-with-lease' \
  "force-push variant detected"
check 'git[[:space:]]+(reset[[:space:]]+--hard|clean[[:space:]]+-[a-z]*[fd])' \
  "destructive git worktree operation (reset --hard / clean)"
check 'git[[:space:]]+checkout[[:space:]]+--[[:space:]]+\.' \
  "git checkout -- . discards all uncommitted work"
check 'git[[:space:]]+branch[[:space:]]+-D' \
  "force branch delete"

# --- 3. Destructive SQL ------------------------------------------------------
# Case-insensitive (bash =~ is case-sensitive by default), and no trailing
# semicolon requirement -- `DELETE FROM users` was previously allowed.
check '(drop[[:space:]]+(database|schema|table)|truncate[[:space:]]+(table[[:space:]]+)?[a-z_])' \
  "destructive SQL DDL"
check '(delete[[:space:]]+from|update[[:space:]]+[a-z_]+[[:space:]]+set|alter[[:space:]]+table)' \
  "destructive SQL DML"
check '(grant[[:space:]]+all|revoke[[:space:]]+all)' \
  "privilege escalation in SQL"

# --- 4. Disk / device --------------------------------------------------------
check '(mkfs|dd[[:space:]]+if=|fdisk[[:space:]]|parted[[:space:]]+/dev)' \
  "raw disk operation"
# Fork bomb. `:` is shell metacharacter-free, so match the structural shape
# directly rather than relying on character classes around `:`.
check '\{[[:space:]]*:[[:space:]]*\|[[:space:]]*:[[:space:]]*;[[:space:]]*\}' \
  "fork bomb"

# --- 5. Credential exfiltration ---------------------------------------------
check '(curl|wget)[[:space:]].*\|[[:space:]]*(sudo[[:space:]]+)?(ba)?sh' \
  "piping a download straight into a shell"
check '(base64[[:space:]]+-d|base64[[:space:]]+--decode).*\|' \
  "decoding an encoded payload into a pipe"

# --- 6. Package publishing ---------------------------------------------------
# An agent has no business publishing from an unprompted tool call; the release
# workflow owns this. This is a guardrail, not an authorisation.
check '(npm|yarn|pnpm)[[:space:]]+publish' \
  "package publish must go through the release workflow, not an ad-hoc tool call"

exit 0