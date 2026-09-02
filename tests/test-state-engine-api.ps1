# ============================================================
# INCIDENT STATE ENGINE — API Integration Test
# ============================================================
# Tests the /api/incidents/:id/events endpoint with the 6-step scenario
# Run: powershell -ExecutionPolicy Bypass -File tests\test-state-engine-api.ps1
# ============================================================

$BASE = "http://localhost:3000"
$INCIDENT_ID = "288b2653-67c3-44af-8125-5d27aa33f1b8"
$PASS = 0
$FAIL = 0

function Assert($condition, $message) {
    if ($condition) {
        Write-Host "  PASS: $message" -ForegroundColor Green
        $script:PASS++
    } else {
        Write-Host "  FAIL: $message" -ForegroundColor Red
        $script:FAIL++
    }
}

function Now() { (Get-Date).ToString("o") }

Write-Host ''
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host ' INCIDENT STATE ENGINE - API Integration Test' -ForegroundColor Cyan
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host ''

# ─── STEP 1: Payment failures increase ───
Write-Host "STEP 1: Payment failures increase (OBSERVATION)" -ForegroundColor Yellow
$body = @{
    kind = "OBSERVATION"
    topic = "Payment API errors increasing"
    statement = "Payment API returning 500 errors. Error rate jumped from 0.1% to 15%."
    source = @{ type = "HUMAN_SPOKEN"; speakerName = "Shivam"; speakerRole = "ENGINEER"; timestamp = (Now); confidence = 0.9 }
} | ConvertTo-Json -Depth 5

$r = Invoke-WebRequest -Uri "$BASE/api/incidents/$INCIDENT_ID/events" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 30
$result = $r.Content | ConvertFrom-Json

Assert ($result.results[0].stateChanged -eq $true) "Observation should change state"
Assert ($result.results[0].actions[0].operation -eq "CREATED") "Should CREATE a fact"
Assert ($result.summary.created -ge 1) "Summary should show 1+ created"

# ─── STEP 2: Engineer reports DB latency ───
Write-Host ""
Write-Host "STEP 2: Engineer reports DB latency (FACT_REPORT)" -ForegroundColor Yellow
$body = @{
    kind = "FACT_REPORT"
    topic = "Database latency"
    statement = "PostgreSQL connection pool exhausted. CPU at 95%. Query latency 5+ seconds."
    source = @{ type = "HUMAN_SPOKEN"; speakerName = "Amit"; speakerRole = "SRE"; timestamp = (Now); confidence = 0.95 }
} | ConvertTo-Json -Depth 5

$r = Invoke-WebRequest -Uri "$BASE/api/incidents/$INCIDENT_ID/events" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 30
$result = $r.Content | ConvertFrom-Json

Assert ($result.results[0].stateChanged -eq $true) "Fact report should change state"
Assert ($result.results[0].actions[0].operation -eq "CREATED") "Should CREATE a fact"

# ─── STEP 3: Second engineer reports DB healthy (CONFLICT!) ───
Write-Host ""
Write-Host "STEP 3: Engineer reports DB healthy (should DETECT CONFLICT)" -ForegroundColor Yellow
$body = @{
    kind = "FACT_REPORT"
    topic = "Database latency"
    statement = "Database CPU normal at 30%. No latency issues. Connection pool healthy."
    source = @{ type = "HUMAN_SPOKEN"; speakerName = "Rahul"; speakerRole = "ENGINEER"; timestamp = (Now); confidence = 0.9 }
} | ConvertTo-Json -Depth 5

$r = Invoke-WebRequest -Uri "$BASE/api/incidents/$INCIDENT_ID/events" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 30
$result = $r.Content | ConvertFrom-Json

$hasConflict = $false
foreach ($action in $result.results[0].actions) {
    if ($action.operation -eq "CONFLICT_DETECTED") { $hasConflict = $true }
}
Assert $hasConflict "Should DETECT conflict between DB health claims"

# ─── STEP 4: Deployment hypothesis ───
Write-Host ""
Write-Host "STEP 4: Support reports failure after deployment (HYPOTHESIS)" -ForegroundColor Yellow
$body = @{
    kind = "HYPOTHESIS"
    topic = "Deployment caused outage"
    statement = "Customers saw failures immediately after v2.3.1 deployment at 14:30 UTC."
    source = @{ type = "HUMAN_SPOKEN"; speakerName = "Priya"; speakerRole = "INCIDENT_COMMANDER"; timestamp = (Now); confidence = 0.85 }
    supportingEvidence = @("Error rate increased after deployment", "Customer reports correlate with deployment time")
} | ConvertTo-Json -Depth 5

$r = Invoke-WebRequest -Uri "$BASE/api/incidents/$INCIDENT_ID/events" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 30
$result = $r.Content | ConvertFrom-Json

Assert ($result.results[0].stateChanged -eq $true) "Hypothesis should change state"
Assert ($result.results[0].actions[0].operation -eq "CREATED") "Should CREATE a hypothesis"

# ─── STEP 5: Rahul assigned investigation ───
Write-Host ""
Write-Host "STEP 5: Rahul assigned deployment investigation (ACTION)" -ForegroundColor Yellow
$body = @{
    kind = "ACTION_ASSIGNMENT"
    topic = "Investigate deployment"
    statement = "Rahul to investigate v2.3.1 deployment. Check logs, compare with previous release."
    source = @{ type = "HUMAN_SPOKEN"; speakerName = "Priya"; speakerRole = "INCIDENT_COMMANDER"; timestamp = (Now); confidence = 0.95 }
    assignee = "Rahul"
    isCritical = $false
} | ConvertTo-Json -Depth 5

$r = Invoke-WebRequest -Uri "$BASE/api/incidents/$INCIDENT_ID/events" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 30
$result = $r.Content | ConvertFrom-Json

Assert ($result.results[0].stateChanged -eq $true) "Action should change state"
$actionCreated = $false
foreach ($action in $result.results[0].actions) {
    if ($action.operation -eq "CREATED" -and $action.entityType -eq "ACTION") { $actionCreated = $true }
}
Assert $actionCreated "Should CREATE an action"

# ─── STEP 6: Verify final state ───
Write-Host ""
Write-Host "STEP 6: Verify final state" -ForegroundColor Yellow

# Check facts
$r = Invoke-WebRequest -Uri "$BASE/api/incidents/$INCIDENT_ID/facts" -UseBasicParsing -TimeoutSec 10
$facts = $r.Content | ConvertFrom-Json
Assert ($facts.Count -ge 2) "Should have 2+ facts (payment errors + DB latency)"

# Check hypotheses
$r = Invoke-WebRequest -Uri "$BASE/api/incidents/$INCIDENT_ID/hypotheses" -UseBasicParsing -TimeoutSec 10
$hypotheses = $r.Content | ConvertFrom-Json
Assert ($hypotheses.Count -ge 1) "Should have 1+ hypothesis (deployment caused outage)"

# Check conflicts
$r = Invoke-WebRequest -Uri "$BASE/api/incidents/$INCIDENT_ID/conflicts" -UseBasicParsing -TimeoutSec 10
$conflicts = $r.Content | ConvertFrom-Json
Assert ($conflicts.Count -ge 1) "Should have 1+ conflict (DB health disagree)"

# Check actions
$r = Invoke-WebRequest -Uri "$BASE/api/incidents/$INCIDENT_ID/actions" -UseBasicParsing -TimeoutSec 10
$actions = $r.Content | ConvertFrom-Json
$rahulAction = $actions | Where-Object { $_.assignee.name -eq "Rahul" }
Assert ($null -ne $rahulAction) "Should have action assigned to Rahul"

# Check timeline
$r = Invoke-WebRequest -Uri "$BASE/api/incidents/$INCIDENT_ID/timeline" -UseBasicParsing -TimeoutSec 10
$timeline = $r.Content | ConvertFrom-Json
Assert ($timeline.Count -ge 5) "Timeline should have 5+ events"

# Check open questions
$r = Invoke-WebRequest -Uri "$BASE/api/incidents/$INCIDENT_ID/questions" -UseBasicParsing -TimeoutSec 10
$questions = $r.Content | ConvertFrom-Json
Write-Host "  Info: $($questions.Count) open questions" -ForegroundColor Gray

# ─── IDEMPOTENCY TEST ───
Write-Host ""
Write-Host "IDEMPOTENCY TEST: Send same observation again" -ForegroundColor Yellow
$body = @{
    kind = "OBSERVATION"
    topic = "Payment API errors increasing"
    statement = "Payment API returning 500 errors. Error rate jumped from 0.1% to 15%."
    source = @{ type = "HUMAN_SPOKEN"; speakerName = "Shivam"; speakerRole = "ENGINEER"; timestamp = (Now); confidence = 0.9 }
} | ConvertTo-Json -Depth 5

$r = Invoke-WebRequest -Uri "$BASE/api/incidents/$INCIDENT_ID/events" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 30
$result = $r.Content | ConvertFrom-Json

Assert ($result.results[0].stateChanged -eq $false) "Duplicate observation should NOT change state"
Assert ($result.results[0].actions[0].operation -eq "SKIPPED") "Should SKIP duplicate"

# ─── DECISION TEST ───
Write-Host ''
Write-Host 'DECISION TEST: Suggestion without agreement (should become question)' -ForegroundColor Yellow
$body = @{
    kind = "DECISION"
    topic = "Rollback deployment"
    statement = "We should rollback to v2.3.0"
    source = @{ type = "HUMAN_SPOKEN"; speakerName = "Shivam"; speakerRole = "ENGINEER"; timestamp = (Now); confidence = 0.9 }
    agreedBy = @()
} | ConvertTo-Json -Depth 5

$r = Invoke-WebRequest -Uri "$BASE/api/incidents/$INCIDENT_ID/events" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 30
$result = $r.Content | ConvertFrom-Json

$isQuestion = $false
foreach ($action in $result.results[0].actions) {
    if ($action.entityType -eq "OPEN_QUESTION") { $isQuestion = $true }
}
Assert $isQuestion "Decision without agreement should create open question"

Write-Host ''
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host " RESULTS: $PASS passed, $FAIL failed" -ForegroundColor $(if ($FAIL -eq 0) { 'Green' } else { 'Red' })
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host ''

if ($FAIL -gt 0) { exit 1 }
