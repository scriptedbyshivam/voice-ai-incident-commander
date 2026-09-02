# ============================================================
# AGORA - AI ANALYSIS DEMO (No Microphone Needed)
# ============================================================
# Yeh script transcript bhej kar AI analysis test karti hai
# Ollama automatically facts, hypotheses, conflicts extract karega
# ============================================================

$BASE = "http://localhost:3000"
$INCIDENT_ID = "288b2653-67c3-44af-8125-5d27aa33f1b8"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " AGORA - AI ANALYSIS DEMO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Simulated live transcripts (jaise koi bol raha ho voice room mein)
$transcripts = @(
    @{ speakerName = "Shivam"; speakerRole = "ENGINEER"; text = "Payment API 500 errors de raha hai. PostgreSQL connection pool exhausted ho gaya hai." },
    @{ speakerName = "Amit"; speakerRole = "SRE"; text = "Database CPU 95 percent pe hai. Koi heavy query chal rahi hai lagta hai." },
    @{ speakerName = "Priya"; speakerRole = "INCIDENT_COMMANDER"; text = "Rollback karo pichle stable release pe. Abhi production down hai 15 minute se." },
    @{ speakerName = "Shivam"; speakerRole = "ENGINEER"; text = "Haan rollback karte hain. Connection pool size bhi badhani padegi 50 se 200." },
    @{ speakerName = "Rahul"; speakerRole = "SUPPORT"; text = "Customer complaints aa rahe hain. 50 users affected hain abhi tak." },
    @{ speakerName = "Amit"; speakerRole = "SRE"; text = "Kubernetes pods restart ho rahe hain. Memory limit 512MB bahut kam hai." }
)

Write-Host "[INFO] Sending $($transcripts.Count) simulated transcript segments to AI..." -ForegroundColor Yellow
Write-Host ""

foreach ($i in 0..($transcripts.Count - 1)) {
    $t = $transcripts[$i]
    $body = @{
        transcript = $t.text
        speakerName = $t.speakerName
        speakerRole = $t.speakerRole
        timestamp = (Get-Date).AddSeconds(-($transcripts.Count - $i)).ToString("o")
    } | ConvertTo-Json -Depth 2

    Write-Host "[$($i+1)/$($transcripts.Count)] $($t.speakerName) ($($t.speakerRole)): $($t.text)" -ForegroundColor White
    
    try {
        $r = Invoke-WebRequest -Uri "$BASE/api/incidents/$INCIDENT_ID/analyze" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 60
        $result = $r.Content | ConvertFrom-Json
        
        if ($result.ok) {
            $analysis = $result.analysis
            
            # Show extracted facts
            if ($analysis.facts -and $analysis.facts.Count -gt 0) {
                Write-Host "  -> Facts extracted: $($analysis.facts.Count)" -ForegroundColor Green
                foreach ($f in $analysis.facts) {
                    Write-Host "     * $f" -ForegroundColor Gray
                }
            }
            
            # Show hypotheses
            if ($analysis.hypotheses -and $analysis.hypotheses.Count -gt 0) {
                Write-Host "  -> Hypotheses: $($analysis.hypotheses.Count)" -ForegroundColor Yellow
                foreach ($h in $analysis.hypotheses) {
                    Write-Host "     ? $h" -ForegroundColor Gray
                }
            }
            
            # Show conflicts
            if ($analysis.conflicts -and $analysis.conflicts.Count -gt 0) {
                Write-Host "  -> Conflicts detected!" -ForegroundColor Red
                foreach ($c in $analysis.conflicts) {
                    Write-Host "     ! $c" -ForegroundColor Red
                }
            }
            
            # Show actions
            if ($analysis.actions -and $analysis.actions.Count -gt 0) {
                Write-Host "  -> Actions suggested:" -ForegroundColor Magenta
                foreach ($a in $analysis.actions) {
                    Write-Host "     > $a" -ForegroundColor Gray
                }
            }
        } else {
            Write-Host "  -> Analysis returned ok=false" -ForegroundColor Red
        }
    } catch {
        Write-Host "  -> ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
    Start-Sleep -Seconds 1
}

# ---- FINAL: Check what's in DB now ----
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " CHECKING DATABASE..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[FACTS]" -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "$BASE/api/incidents/$INCIDENT_ID/facts" -UseBasicParsing -TimeoutSec 10
    $facts = $r.Content | ConvertFrom-Json
    Write-Host "  Total facts: $($facts.Count)" -ForegroundColor Green
    foreach ($f in $facts) {
        Write-Host "    - $($f.content) (verified: $($f.verified))" -ForegroundColor Gray
    }
} catch {
    Write-Host "  Error fetching facts" -ForegroundColor Red
}

Write-Host ""
Write-Host "[HYPOTHESES]" -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "$BASE/api/incidents/$INCIDENT_ID/hypotheses" -UseBasicParsing -TimeoutSec 10
    $hyp = $r.Content | ConvertFrom-Json
    Write-Host "  Total hypotheses: $($hyp.Count)" -ForegroundColor Green
    foreach ($h in $hyp) {
        Write-Host "    - $($h.content) (status: $($h.status))" -ForegroundColor Gray
    }
} catch {
    Write-Host "  Error fetching hypotheses" -ForegroundColor Red
}

Write-Host ""
Write-Host "[CONFLICTS]" -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "$BASE/api/incidents/$INCIDENT_ID/conflicts" -UseBasicParsing -TimeoutSec 10
    $conflicts = $r.Content | ConvertFrom-Json
    Write-Host "  Total conflicts: $($conflicts.Count)" -ForegroundColor Green
    foreach ($c in $conflicts) {
        Write-Host "    - $($c.description) (status: $($c.status))" -ForegroundColor Gray
    }
} catch {
    Write-Host "  Error fetching conflicts" -ForegroundColor Red
}

Write-Host ""
Write-Host "[TIMELINE]" -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "$BASE/api/incidents/$INCIDENT_ID/timeline" -UseBasicParsing -TimeoutSec 10
    $timeline = $r.Content | ConvertFrom-Json
    Write-Host "  Timeline events: $($timeline.Count)" -ForegroundColor Green
    foreach ($e in $timeline) {
        Write-Host "    - [$($e.type)] $($e.content)" -ForegroundColor Gray
    }
} catch {
    Write-Host "  Error fetching timeline" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " DEMO COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ab browser mein incident dashboard dekho:" -ForegroundColor White
Write-Host "  http://localhost:3000/incidents/$INCIDENT_ID" -ForegroundColor White
Write-Host ""
Write-Host "Voice room test karo:" -ForegroundColor White
Write-Host "  http://localhost:3000/incidents/$INCIDENT_ID/room" -ForegroundColor White
Write-Host ""
