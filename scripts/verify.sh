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
  m() { printf '%s' "$MASK" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);console.log($1)}catch{console.log('ERR')}})"; }

  CURVES=$(m "(j.path.match(/C/g)||[]).length")
  if [ "${CURVES:-0}" -ge 8 ]; then ok "screen outline is a continuous curve ($CURVES segments)"
  else bad "screen outline is a continuous curve (got $CURVES segments)"; fi

  # The outline must be ONE subpath. Capturing the clipping rectangle alongside
  # it produced a path that looked fine as a string and filled the entire canvas
  # when rendered, which silently invalidated every measurement taken from it.
  check "outline is a single subpath"      "$(m "(j.path.match(/M/g)||[]).length")" "1"
  check "device scale read from plist"     "$(m "j.scale")" "3"

  # Sanity-bound the geometry. A full rectangle would fit an enormous exponent
  # and a corner extent near zero, so both ranges catch a broken extraction.
  EXP=$(m "j.cornerExponent")
  RAT=$(m "j.cornerExtentRatio")
  if node -e "process.exit(($EXP>=2.4 && $EXP<=3.6)?0:1)" 2>/dev/null; then ok "corner exponent in range ($EXP)"; else bad "corner exponent in range (got $EXP)"; fi
  if node -e "process.exit(($RAT>=0.15 && $RAT<=0.25)?0:1)" 2>/dev/null; then ok "corner extent ratio in range ($RAT)"; else bad "corner extent ratio in range (got $RAT)"; fi

  # CSS corner-shape takes log2 of the exponent. Passing the exponent straight
  # through asks for 2^2.9 and draws a near-square corner, which is the exact
  # bug this guards.
  CSS=$(m "j.cornerSuperellipseCss")
  if node -e "process.exit(Math.abs($CSS-Math.log2($EXP))<0.01?0:1)" 2>/dev/null; then ok "css value is log2 of the exponent ($CSS)"; else bad "css value is log2 of the exponent (got $CSS for exponent $EXP)"; fi
else
  printf '  \033[33mSKIP\033[0m  device mask tests (no Xcode simulator profiles)\n'
fi

CHROME="${CHROME_PATH:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
if [ -x "$CHROME" ]; then
  # The frame corner must actually be a superellipse, not a circle. Rendering
  # the same box with and without corner-shape and comparing bytes proves the
  # geometry is applied: identical files would mean it silently did nothing.
  S=$(mktemp -d)
  for variant in super circle; do
    if [ "$variant" = super ]; then SHAPE="corner-shape:superellipse(2.9);"; else SHAPE=""; fi
    cat > "$S/$variant.html" <<HTML
<!doctype html><html><head><style>
html,body{margin:0;padding:0;width:400px;height:400px;background:#fff}
div{width:400px;height:400px;background:#000;border-radius:100px;$SHAPE}
</style></head><body><div></div></body></html>
HTML
    "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
      --window-size=400,400 --screenshot="$S/$variant.png" "file://$S/$variant.html" >/dev/null 2>&1
  done
  if [ -f "$S/super.png" ] && [ -f "$S/circle.png" ]; then
    if cmp -s "$S/super.png" "$S/circle.png"; then bad "corner-shape changes the rendered corner (no effect: fell back to a circle)"
    else ok "corner-shape changes the rendered corner"; fi
  else
    printf '  \033[33mSKIP\033[0m  corner-shape render check (screenshot failed)\n'
  fi
  rm -rf "$S"

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
