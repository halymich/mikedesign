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
echo "7. Multi-target projects resolve, and never get guessed at"
T=$(mktemp -d)
cat > "$T/DESIGN.md" <<'EOF'
```json
{
  "brand": { "palette": ["#ff2d95"], "fonts": { "display": "Cabinet Grotesk" } },
  "targets": {
    "ios": { "platform": "ios", "surfaceType": "operate" },
    "web": { "platform": "web", "surfaceType": "persuade", "palette": ["#6366f1"] }
  }
}
EOF
echo '```' >> "$T/DESIGN.md"
node scripts/lint.mjs --rendered "$SLOP" --design "$T/DESIGN.md" >/dev/null 2>&1
check "two targets, none named, exits 2" "$?" "2"
node scripts/lint.mjs --rendered "$SLOP" --design "$T/DESIGN.md" --target nope >/dev/null 2>&1
check "unknown target exits 2"           "$?" "2"
SURF=$(node scripts/lint.mjs --rendered "$SLOP" --design "$T/DESIGN.md" --target ios --json 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).surface))')
check "target sets its own surface type" "$SURF" "operate"
# The web target declares one of the three indigo shades on the fixture. That one
# must go quiet and the other two must not, which proves the target palette is
# merged into the brand rather than replacing it or being ignored.
indigo() { node scripts/lint.mjs --rendered "$SLOP" "$@" --json 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.findings.filter(f=>f.id==="indigo-violet-default").length)})'; }
check "brand alone silences none"        "$(indigo --design "$T/DESIGN.md" --target ios)" "3"
check "target palette silences its own"  "$(indigo --design "$T/DESIGN.md" --target web)" "2"
rm -rf "$T"

echo
echo "8. Store assets are checked against real store rules"
node scripts/shots.mjs devices ios >/dev/null 2>&1
check "device specs load"                "$?" "0"
A=$(mktemp -d); mkdir -p "$A/en-US"; cp fixtures/store/screens/home.png "$A/en-US/01.png"
node scripts/shots.mjs verify "$A" --platform ios --device iphone-6.9 >/dev/null 2>&1
check "alpha channel is rejected"        "$?" "1"
rm -rf "$A"

if [ -d /Library/Developer/CoreSimulator/Profiles/DeviceTypes ]; then
  node scripts/device-mask.mjs list >/dev/null 2>&1
  check "device types enumerate"           "$?" "0"
  MASK=$(node scripts/device-mask.mjs "iPhone 17 Pro Max" --json 2>/dev/null)
  CURVES=$(printf '%s' "$MASK" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log((JSON.parse(s).path.match(/C/g)||[]).length)}catch{console.log(0)}})')
  # A real screen outline is a continuous curve of many segments. One or two
  # would mean we grabbed a rounded rectangle and the whole point was lost.
  if [ "${CURVES:-0}" -ge 8 ]; then ok "screen outline is a continuous curve ($CURVES segments)"
  else bad "screen outline is a continuous curve (got $CURVES segments)"; fi
  SCALE=$(printf '%s' "$MASK" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).scale)}catch{console.log("?")}})')
  check "device scale read from plist"     "$SCALE" "3"
else
  printf '  \033[33mSKIP\033[0m  device mask tests (no Xcode simulator profiles)\n'
fi

CHROME="${CHROME_PATH:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
if [ -x "$CHROME" ]; then
  R=$(mktemp -d)
  (cd fixtures/store && node ../../scripts/shots.mjs render --template template.html --data captions.json --out "$R") >/dev/null 2>&1
  check "renders every locale at exact size" "$?" "0"
  check "wrote one file per panel per locale" "$(find "$R" -name '*.png' | wc -l | tr -d ' ')" "6"
  node scripts/shots.mjs verify "$R" --platform ios --device iphone-6.9 >/dev/null 2>&1
  check "rendered output passes store verify" "$?" "0"
  rm -rf "$R"
else
  printf '  \033[33mSKIP\033[0m  render tests (no Chrome found; set CHROME_PATH)\n'
fi

echo
echo "-----------------------------------------"
printf '  %d passed, %d failed\n\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
