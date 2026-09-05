# DealFlow360 - one command to run everything. Localhost only, no cloud in the
# critical path (CLINCH.md 5, Failure Point 4).
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$py = Join-Path $root ".venv\Scripts\python.exe"

if (-not (Test-Path $py)) {
    Write-Host "First run: creating venv..." -ForegroundColor Yellow
    python -m venv (Join-Path $root ".venv")
    & $py -m pip install --quiet -r (Join-Path $root "backend\requirements.txt")
}

Write-Host "API   -> http://localhost:8000/docs"    -ForegroundColor Green
Write-Host "Board -> http://localhost:8000/_status" -ForegroundColor Green
Set-Location (Join-Path $root "backend")
& $py -m uvicorn api.main:app --reload --port 8000
