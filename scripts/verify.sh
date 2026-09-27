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
# Rules restricted to one surface type or to native source have their own
# tests in section 10; the slop fixture is a persuade page in HTML.
DECLARED=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("data/rules.json","utf8")).rules.filter(r=>r.scope==="rendered"&&!r.surfaces).length)')
DESIGNFIRED=$(node scripts/lint.mjs --rendered "$SLOP" --source fixtures/slop.html --json 2>/dev/null \
  | node -e 'const own=new Set(require("./data/rules.json").rules.map(r=>r.id));let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(new Set(j.findings.map(f=>f.id).filter(id=>own.has(id)||id.startsWith("budget-"))).size)})')
# declared rendered rules + the two budget ids (headline, subhead)
check "all design rules fire" "$DESIGNFIRED" "$((DECLARED + 2))"

# The words belong to mikecopy. Installed beside this skill, its rules check the
# copy on the page; missing, the design checks still run and the report says the
# words were not checked, rather than implying they were.
MC="${MIKECOPY_HOME:-../mikecopy}"
if [ -f "$MC/data/rules.json" ]; then
  TXT=$(node scripts/lint.mjs --rendered "$SLOP" --json 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.text.loaded&&j.findings.some(f=>f.id==="em-dash-in-copy")&&j.findings.some(f=>f.id==="ai-vocabulary")?"yes":"no")})')
  check "mikecopy text rules check the page" "$TXT" "yes"
else
  printf '  \033[33mSKIP\033[0m  mikecopy text rules (not installed beside this skill)\n'
fi
LONE=$(mktemp -d); mkdir -p "$LONE/md"; cp -R scripts data "$LONE/md/"
LONEOUT=$(node "$LONE/md/scripts/lint.mjs" --rendered "$SLOP" --json 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.text.loaded+"/"+j.findings.some(f=>f.id==="em-dash-in-copy")+"/"+j.findings.some(f=>f.id==="gradient-text"))})')
check "without mikecopy: design runs, words reported unchecked" "$LONEOUT" "false/false/true"
LONEHUMAN=$(node "$LONE/md/scripts/lint.mjs" --rendered "$SLOP" 2>/dev/null || true)
case "$LONEHUMAN" in *"words:    NOT CHECKED"*) ok "the human report says so";; *) bad "the human report says so";; esac
rm -rf "$LONE"

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

# A system brief must also demand scope, because an unscoped design system grows
# to cover everything and is then re-read on every later command.
node scripts/brief.mjs init "$B" system --type persuade >/dev/null 2>&1
SB="$B/.mikedesign/brief-system.md"
for f in surfaces component-scope deferred; do
  if grep -q "^- $f:" "$SB"; then ok "system brief requires $f"; else bad "system brief requires $f"; fi
done
node scripts/brief.mjs check "$SB" >/dev/null 2>&1
# 11 stubs = 12 system fields minus surface-type, which init fills in
check "scope fields are enforced"   "$(grep -c 'ASSUMED:' "$SB")" "11"
# and a plain surface must NOT inherit them
check "base brief stays base"       "$(grep -c '^- surfaces:' "$B/.mikedesign/brief-home.md")" "0"
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
echo "8. The eyebrow ban catches the pattern, not the class name"
eyebrow() { node scripts/lint.mjs --rendered "$1" --json 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.findings.filter(f=>f.id==="eyebrow-label").length)})'; }
# Two on the slop page: the naive uppercase <p> sibling, and a sentence-case
# teal <span> wrapped in its own div above an h2. The second is the regression
# that matters, because it is what component libraries actually emit and what
# the old uppercase-plus-nextElementSibling test could not see.
check "both eyebrows caught, wrapped included" "$(eyebrow "$SLOP")" "2"
# The clean page carries four elements sitting above a heading: a breadcrumb of
# real links, a step counter, a dateline in a <time>. None is an eyebrow and none
# may fire, or the exemptions are theatre.
check "permitted components do not fire"       "$(eyebrow "$CLEAN")" "0"
# A call to action above a heading matches the geometry exactly and must be
# excluded as a control, not rescued by the link exemption.
CTA=$(node scripts/lint.mjs --rendered "$SLOP" --json 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.findings.filter(f=>f.id==="eyebrow-label"&&/Get started/.test(f.evidence)).length)})')
check "a CTA above a heading is not an eyebrow" "$CTA" "0"

echo
echo "9. Store assets are checked against real store rules"
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
    "$CHROME" --headless=new ${CI:+--no-sandbox} --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
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
echo "10. Product UI checks"
U=$(mktemp -d)
node -e '
const el=(i,o)=>Object.assign({i,tag:"DIV",cls:"",id:"",text:"",role:"body",prevTag:"",nextTag:"",nextIsHeadline:false,above:null,isLink:false,inBreadcrumb:false,timeTag:false,parentTag:"BODY",parentSig:"p"+i,sig:"s"+i,x:0,y:0,w:300,h:40,focusable:false,childCount:0},o);
const st=(o)=>Object.assign({color:"rgb(20, 20, 20)",backgroundColor:"rgb(250, 248, 244)",backgroundImage:"none",webkitBackgroundClip:"border-box",backdropFilter:"none",boxShadow:"none",fontFamily:"Fraunces",fontSize:"16px",fontWeight:"400",textTransform:"none",borderRadius:"0px",filter:"none",borderTopColor:"rgb(20, 20, 20)",borderLeftWidth:"0px",fill:"none",transitionProperty:"all",position:"static"},o);
const page={ok:true,collector:"mikedesign/1",url:"fixture://ui",viewport:{w:390,h:844},pageBackground:"rgb(250, 248, 244)",pageColor:"rgb(20, 20, 20)",coverage:{scanned:6,kept:6,truncated:false},elements:[
 el(0,{text:"Bookings",styles:st({fontSize:"25px"})}),
 el(1,{text:"Toronto hotel",styles:st({fontSize:"20px"})}),
 el(2,{text:"Checks every six hours",styles:st({fontSize:"16px"})}),
 el(3,{text:"Updated today",styles:st({fontSize:"12.8px"})}),
 el(4,{text:"Drop found",styles:st({fontSize:"18px"})}),
 el(5,{tag:"NAV",text:"Tab bar",styles:st({backdropFilter:"blur(20px)",position:"fixed"})}),
 el(6,{text:"Glass card",styles:st({backdropFilter:"blur(20px)",position:"relative"})})
]};
require("fs").writeFileSync(process.argv[1],JSON.stringify(page));' "$U/ui.json"
ui() { node scripts/lint.mjs --rendered "$U/ui.json" "$@" --json 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.findings.filter(f=>f.id===process.env.ID).map(f=>f.evidence.split(" ")[0]).join(",")||"none")})'; }
GLASS=$(node scripts/lint.mjs --rendered "$U/ui.json" --surface operate --json 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.findings.filter(f=>f.id==="glass-decoration").map(f=>f.where.match(/"(.*)"/)[1]).join(","))})')
check "glass flagged on the in-flow card only, not the fixed bar" "$GLASS" "Glass card"
check "off-scale size caught on product UI"    "$(ID=type-scale-off-ratio ui --surface operate)" "18px"
check "scale not imposed on a persuade page"   "$(ID=type-scale-off-ratio ui --surface persuade)" "none"
printf '```json\n{ "brand": { "typeScale": { "base": 16, "ratio": 1.333 } } }\n```\n' > "$U/DESIGN.md"
check "a declared scale replaces the default"  "$(ID=type-scale-off-ratio ui --surface persuade --design "$U/DESIGN.md")" "25px,20px,12.8px,18px"
cat > "$U/View.swift" <<'EOF'
Text("Fixed").font(.system(size: 17))
Text("Scaled").font(.system(size: 17, relativeTo: .body))
// Text("Commented").font(.system(size: 12))
Text("Style").font(.headline)
EOF
SW=$(node scripts/lint.mjs --source "$U/View.swift" --json 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.findings.filter(f=>f.id==="swift-fixed-font-size").map(f=>f.where.split(":").pop()).join(","))})')
check "fixed Swift font size caught, scaled ones not" "$SW" "1"
rm -rf "$U"

echo
echo "11. Product UI measurement in a real browser"
if [ -x "$CHROME" ] || [ -n "${CHROME_PATH:-}" ]; then
  PORT=8931
  node -e 'const h=require("http"),f=require("fs"),p=require("path");h.createServer((q,r)=>{const file=p.join("fixtures/ui",p.basename(q.url.split("?")[0]));f.readFile(file,(e,b)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{"content-type":"text/html"});r.end(b)})}).listen(+process.argv[1])' $PORT &
  SRV=$!; sleep 0.5
  MERR=$(mktemp)
  mj() { node scripts/measure.mjs "http://127.0.0.1:$PORT/$1" --profile desktop --json 2>>"$MERR"; }
  GOOD=$(mj good.html); GOODX=$?
  BAD=$(mj bad.html); BADX=$?
  jget() { printf '%s' "$1" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log($2)})"; }
  check "lean, stable, accessible page meets every target" "$GOODX" "0"
  check "slow tap handler is caught"          "$(jget "$BAD" "j.runs[0].checks.tapResponse.status")" "miss"
  check "late layout shift is caught"         "$(jget "$BAD" "j.runs[0].checks.layoutShift.status")" "miss"
  if [ "$(jget "$BAD" "j.axe.error===null")" = "true" ]; then
    check "missing alt text and label are caught" "$(jget "$BAD" "['image-alt','label'].every(id=>j.runs[0].a11y.some(v=>v.id===id))")" "true"
  else
    printf '  \033[33mSKIP\033[0m  accessibility assertions (axe-core unavailable offline)\n'
  fi
  check "a miss exits 1, not 0"               "$BADX" "1"
  # Security: with no --tap it must never touch anything that can write saved
  # data. The fixture carries a checkbox and a settings switch that also has
  # aria-expanded, next to one harmless disclosure.
  check "default taps skip checkboxes and switches" "$(jget "$BAD" "j.runs[0].taps.map(t=>t.what).join(',')")" "button[type=submit]"
  LEFT=$(ls -d "${TMPDIR:-/tmp}"/mikedesign-measure-* 2>/dev/null | wc -l | tr -d ' ')
  check "no temporary browser profile left behind" "$LEFT" "0"
  [ -n "${MIKEDESIGN_DEBUG:-}" ] && cut -c1-200 "$MERR"
  if [ "$LEFT" != "0" ]; then
    echo "    diagnostic: chrome processes still running:"; ps -eo pid,ppid,args | grep -i "mikedesign-measure" | grep -v grep | cut -c1-160 | head -5
    echo "    diagnostic: leftover contents:"; for d in "${TMPDIR:-/tmp}"/mikedesign-measure-*; do ls -la "$d" | head -8; done
    file "$CHROME" 2>/dev/null | cut -c1-160
    echo "    diagnostic: measure stderr:"; cut -c1-200 "$MERR"
  fi
  node scripts/measure.mjs "http://127.0.0.1:1/nothing" --profile desktop --json >/dev/null 2>&1
  check "unreachable page is no verdict"      "$?" "2"
  kill $SRV 2>/dev/null
else
  printf '  \033[33mSKIP\033[0m  measurement tests (no Chrome found; set CHROME_PATH)\n'
fi

echo
echo "-----------------------------------------"
printf '  %d passed, %d failed\n\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
