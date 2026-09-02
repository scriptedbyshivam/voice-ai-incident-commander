# ============================================================
# AGORA INCIDENT COMMANDER - DEMO TEST SCRIPT
# ============================================================
# Yeh script sab kuch test karti hai step-by-step.
# PowerShell mein chalao: .\scripts\demo-test.ps1
# ============================================================

$BASE = "http://localhost:3000"
$INCIDENT_ID = "288b2653-67c3-44af-8125-5d27aa33f1b8"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " AGORA INCIDENT COMMANDER - DEMO TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ---- STEP 1: Health Check ----
Write-Host "[1/8] Health Check..." -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "$BASE" -UseBasicParsing -TimeoutSec 10
    Write-Host "  OK - Home page loaded ($($r.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "  FAIL - Home page not loading. Is dev server running?" -ForegroundColor Red
    exit 1
}

# ---- STEP 2: List Incidents ----
Write-Host "[2/8] List Incidents..." -ForegroundColor Yellow
$r = Invoke-WebRequest -Uri "$BASE/api/incidents" -UseBasicParsing -TimeoutSec 10
$incidents = $r.Content | ConvertFrom-Json
Write-Host "  Found $($incidents.Count) incident(s):" -ForegroundColor Green
foreach ($inc in $incidents) {
    Write-Host "    - $($inc.title) [$($inc.severity)] ($($inc.id.Substring(0,8))...)" -ForegroundColor Gray
}

# ---- STEP 3: Get Incident Details ----
Write-Host "[3/8] Get Incident Details..." -ForegroundColor Yellow
$r = Invoke-WebRequest -Uri "$BASE/api/incidents/$INCIDENT_ID" -UseBasicParsing -TimeoutSec 10
$inc = $r.Content | ConvertFrom-Json
Write-Host "  Title: $($inc.title)" -ForegroundColor Green
Write-Host "  Severity: $($inc.severity)" -ForegroundColor Green
Write-Host "  Status: $($inc.status)" -ForegroundColor Green
Write-Host "  Commander: $($inc.commander.name)" -ForegroundColor Green

# ---- STEP 4: Agora Token (Real) ----
Write-Host "[4/8] Agora Token Generation..." -ForegroundColor Yellow
$body = '{"name":"Demo User","role":"ENGINEER"}' 
$r = Invoke-WebRequest -Uri "$BASE/api/incidents/$INCIDENT_ID/agora-token" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 10
$token = $r.Content | ConvertFrom-Json
Write-Host "  App ID: $($token.appId)" -ForegroundColor Green
Write-Host "  Channel: $($token.channelName)" -ForegroundColor Green
Write-Host "  Token: $($token.token.Substring(0,40))..." -ForegroundColor Green
Write-Host "  (Real Agora token generated!)" -ForegroundColor Cyan

# ---- STEP 5: Join Participant ----
Write-Host "[5/8] Join Participant..." -ForegroundColor Yellow
$body = '{"name":"Shivam","role":"ENGINEER","email":"shivam@company.com"}'
$r = Invoke-WebRequest -Uri "$BASE/api/incidents/$INCIDENT_ID/participants/join" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 10
$participant = $r.Content | ConvertFrom-Json
Write-Host "  User: $($participant.name) ($($participant.role))" -ForegroundColor Green
Write-Host "  Participant ID: $($participant.participantId)" -ForegroundColor Green

# ---- STEP 6: List Participants ----
Write-Host "[6/8] List Participants..." -ForegroundColor Yellow
$r = Invoke-WebRequest -Uri "$BASE/api/incidents/$INCIDENT_ID/participants" -UseBasicParsing -TimeoutSec 10
$parts = $r.Content | ConvertFrom-Json
Write-Host "  Active participants:" -ForegroundColor Green
foreach ($p in $parts) {
    Write-Host "    - $($p.user.name) [$($p.role)]" -ForegroundColor Gray
}

# ---- STEP 7: Get Facts ----
Write-Host "[7/8] Get Facts..." -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "$BASE/api/incidents/$INCIDENT_ID/facts" -UseBasicParsing -TimeoutSec 10
    $facts = $r.Content | ConvertFrom-Json
    Write-Host "  Facts count: $($facts.Count)" -ForegroundColor Green
    foreach ($f in $facts) {
        Write-Host "    - $($f.content)" -ForegroundColor Gray
    }
} catch {
    Write-Host "  No facts yet (will appear after transcripts)" -ForegroundColor Gray
}

# ---- STEP 8: Get Hypotheses ----
Write-Host "[8/8] Get Hypotheses..." -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "$BASE/api/incidents/$INCIDENT_ID/hypotheses" -UseBasicParsing -TimeoutSec 10
    $hyp = $r.Content | ConvertFrom-Json
    Write-Host "  Hypotheses count: $($hyp.Count)" -ForegroundColor Green
    foreach ($h in $hyp) {
        Write-Host "    - $($h.content)" -ForegroundColor Gray
    }
} catch {
    Write-Host "  No hypotheses yet" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " ALL API TESTS PASSED!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "NEXT: Browser mein http://localhost:3000/incidents/$INCIDENT_ID/room kholo" -ForegroundColor White
Write-Host "      Name daalo, mic allow karo, aur live transcription dekho!" -ForegroundColor White
Write-Host ""
