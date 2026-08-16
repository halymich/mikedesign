#!/usr/bin/env bash
# mikedesign regression suite.
#
#   bash scripts/verify.sh
#
# Runs against committed rendered snapshots, so it needs no browser and no
# network. Regenerate the snapshots with sink.mjs + collect.js if the collector
# output shape ever changes.
#
# What it asserts is deliberately narrow: that the guarantees this skill makes
# about itself are still true. Every rule catches its own fixture, the clean
# page stays clean, budgets move with surface type, overrides silence rules, and
# an empty target refuses a verdict instead of reporting a pass.

set -uo pipefail
cd "$(dirname "$0")/.." || exit 2

PASS=0; FAIL=0
ok()   { printf '  \033[32mPASS\033[0m  %s\n' "$1"; PASS=$((PASS+1)); }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; FAIL=$((FAIL+1)); }
check(){ if [ "$2" = "$3" ]; then ok "$1 ($3)"; else bad "$1 (expected $3, got $2)"; fi; }

SLOP=fixtures/rendered-slop.json
CLEAN=fixtures/rendered-clean.json

count() { # <args...> -> number of findings at severity $SEV
  node scripts/lint.mjs "$@" --json 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const sev=process.env.SEV;console.log(j.findings.filter(f=>!sev||f.severity===sev).length)})'
}
rules() { # distinct rule ids
  node scripts/lint.mjs "$@" --json 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(new Set(j.findings.map(f=>f.id)).size)})'
}

echo
echo "mikedesign regression suite"
echo

echo "1. Every rule catches its own fixture"
DECLARED=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("data/rules.json","utf8")).rules.length)')
FIRED=$(rules --rendered "$SLOP" --source fixtures/slop.html)
# declared rules + the two budget ids (headline, subhead)
check "all declared rules fire" "$FIRED" "$((DECLARED + 2))"

echo
echo "2. The clean fixture stays clean (no false positives)"
SEV=hard  CH=$(count --rendered "$CLEAN" --source fixtures/clean.html)
SEV=""    CA=$(count --rendered "$CLEAN" --source fixtures/clean.html)
check "zero hard findings"      "$CH" "0"
check "zero findings overall"   "$CA" "0"
node scripts/lint.mjs --rendered "$CLEAN" --source fixtures/clean.html >/dev/null 2>&1
check "exit code 0"             "$?" "0"

echo
echo "3. Budgets move with surface type"
budget() { node scripts/lint.mjs --rendered "$SLOP" --surface "$1" --json 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.findings.filter(f=>f.id.startsWith("budget-")).length)})'; }
check "persuade flags copy"     "$(budget persuade)" "2"
check "read exempts same copy"  "$(budget read)"     "0"

echo
echo "4. A declared palette silences its own rule"
TMP=$(mktemp -d)
cat > "$TMP/DESIGN.md" <<'EOF'
```json
{ "palette": ["#6366f1","#a5b4fc","#818cf8"], "fonts": { "display": "Inter" }, "allow": ["glass-decoration"] }
```
EOF
only() { node scripts/lint.mjs --rendered "$SLOP" "$@" --json 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.findings.filter(f=>f.id===process.env.ID).length)})'; }
ID=indigo-violet-default check "violet flagged when undeclared" "$(ID=indigo-violet-default only)" "3"
check "violet silent when declared"  "$(ID=indigo-violet-default only --design "$TMP/DESIGN.md")" "0"
check "allow list silences glass"    "$(ID=glass-decoration    only --design "$TMP/DESIGN.md")" "0"
rm -rf "$TMP"

echo
echo "5. No coverage means no verdict, never a pass"
EMPTY=$(mktemp -d)
node scripts/lint.mjs --source "$EMPTY" >/dev/null 2>&1
check "empty target exits 2, not 0" "$?" "2"
node scripts/lint.mjs >/dev/null 2>&1
check "no target exits 2"           "$?" "2"
rm -rf "$EMPTY"

echo
echo "6. Unanswered brief fields become recorded assumptions"
B=$(mktemp -d)
node scripts/brief.mjs init "$B" home --type persuade >/dev/null 2>&1
node scripts/brief.mjs check "$B/.mikedesign/brief-home.md" >/dev/null 2>&1
check "incomplete brief exits 1"    "$?" "1"
STUBS=$(grep -c "ASSUMED:" "$B/.mikedesign/brief-home.md")
check "stubs written for each gap"  "$STUBS" "8"
node scripts/brief.mjs check "$B/.mikedesign/brief-home.md" >/dev/null 2>&1
check "re-run does not duplicate"   "$(grep -c 'ASSUMED:' "$B/.mikedesign/brief-home.md")" "8"
rm -rf "$B"

echo
echo "-----------------------------------------"
printf '  %d passed, %d failed\n\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
