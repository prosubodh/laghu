#!/usr/bin/env bash
# =============================================================================
# Stop hook: block premature exit when a verification gate fails.
#
# Design notes (each corrects a defect proven in a prior version):
#
#  - Script discovery uses node + exact key lookup, not grep. `grep -q '"test"'`
#    also matches "test:coverage", "pretest", and any dependency named "test",
#    so the old gate could fire on the wrong script or skip a real one.
#  - The 100% coverage gate is run. It was previously never invoked, so an
#    agent could stop at any coverage level and be told it was verified.
#  - Lint is run. It previously only ran as a PostToolUse hook matched on
#    run_command, so a file edited via a write/edit tool never triggered it.
#  - When nothing can be verified, the hook says so explicitly instead of
#    returning 0. The old version failed OPEN: no package.json, or a non-"test"
#    script name, meant the entire body was skipped and the hook reported
#    success for work it never checked.
# =============================================================================
set -uo pipefail

# Echo the script body if package.json declares exactly this script name.
has_script() {
  node -e '
    const fs = require("fs");
    let pkg;
    try { pkg = JSON.parse(fs.readFileSync("package.json", "utf-8")); }
    catch { process.exit(2); }
    if (pkg.scripts && typeof pkg.scripts[process.argv[1]] === "string") {
      console.log(pkg.scripts[process.argv[1]]);
      process.exit(0);
    }
    process.exit(1);
  ' "$1" 2>/dev/null
}

fail=0
ran_any=0

if [ -f "package.json" ]; then
  # --- Architecture validation ------------------------------------------------
  if [ -n "$(has_script validate)" ]; then
    ran_any=1
    echo "🔍 Running architecture validation..." >&2
    if ! npm run validate --silent; then
      echo "🚨 Stop Verifier: 'npm run validate' failed. Fix agentic configuration before stopping." >&2
      fail=1
    fi
  fi

  # --- Coverage gate ----------------------------------------------------------
  if [ -n "$(has_script test:coverage)" ]; then
    if node -e 'const[m,n]=process.versions.node.split(".").map(Number);process.exit((m>22||(m===22&&n>=8))?0:1)'; then
      ran_any=1
      echo "📈 Running coverage gate..." >&2
      if ! npm run test:coverage --silent; then
        echo "🚨 Stop Verifier: coverage gate failed. Reach 100% before stopping." >&2
        fail=1
      fi
    else
      echo "⚠️  Skipping coverage gate: needs Node >= 22.8 (current: $(node --version))" >&2
    fi
  fi

  # --- Tests ------------------------------------------------------------------
  if [ -n "$(has_script test)" ]; then
    ran_any=1
    echo "🧪 Running test suite..." >&2
    if ! npm test --silent; then
      echo "🚨 Stop Verifier: 'npm test' failed. Fix failing tests before stopping." >&2
      fail=1
    fi
  fi

  # --- Lint -------------------------------------------------------------------
  if [ -n "$(has_script lint)" ]; then
    ran_any=1
    echo "🔎 Running lint..." >&2
    if ! npm run lint --silent; then
      echo "🚨 Stop Verifier: lint failed. Fix lint errors before stopping." >&2
      fail=1
    fi
  fi
fi

if [ "$ran_any" -eq 0 ]; then
  echo "⚠️  Stop Verifier: no verifiable scripts found in package.json -- nothing was checked." >&2
  echo "    If this workspace has no Node toolchain, disable the stop-verifier hook." >&2
fi

exit $fail