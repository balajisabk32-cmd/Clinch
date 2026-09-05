# DealFlow360 — Multi-Service Unified Development Launcher
param(
    [ValidateSet("all", "api", "frontend", "admin", "clinch", "reporting", "showcase")]
    [string]$Service = "all"
)

$root = $PSScriptRoot
$py = Join-Path $root ".venv\Scripts\python.exe"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   DealFlow360 (Clinch) Multi-Service Environment" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  1. Showcase & Landing:  http://localhost:8085" -ForegroundColor White
Write-Host "  2. React Workspace:     http://localhost:5173 (Login: /login)" -ForegroundColor White
Write-Host "  3. RevOps Admin Portal: http://localhost:3000" -ForegroundColor White
Write-Host "  4. Python API Engine:   http://localhost:8000/docs" -ForegroundColor White
Write-Host "  5. Clinch Core API:     http://localhost:5000" -ForegroundColor White
Write-Host "  6. Deal Health Suite:   http://localhost:4000" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan

function Start-PythonBackend {
    if (-not (Test-Path $py)) {
        Write-Host "Setting up Python virtual environment..." -ForegroundColor Yellow
        python -m venv (Join-Path $root ".venv")
        & $py -m pip install --quiet -r (Join-Path $root "backend\requirements.txt")
    }
    Write-Host "Launching Python FastAPI Intelligence Engine (:8000)..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; & '$py' -m uvicorn api.main:app --reload --port 8000"
}

function Start-Frontend {
    Write-Host "Launching React Vite Frontend (:5173)..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm run dev"
}

function Start-AdminPortal {
    Write-Host "Launching DealFlow360 RevOps Admin Portal (:3000)..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\admin-portal'; npm run dev"
}

function Start-ClinchCore {
    Write-Host "Launching Clinch Core API & Test Bench (:5000)..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\clinch'; npm start"
}

function Start-ClinchReporting {
    Write-Host "Launching Clinch Deal Health Suite (:4000)..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\clinch'; npm run start:reporting"
}

function Start-Showcase {
    Write-Host "Launching Showcase Server (:8085)..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\showcase'; python -m http.server 8085"
}

switch ($Service) {
    "all" {
        Start-PythonBackend
        Start-Frontend
        Start-AdminPortal
        Start-ClinchCore
        Start-ClinchReporting
        Start-Showcase
        Write-Host "`nAll 6 DealFlow360 services launched in background terminal windows." -ForegroundColor Cyan
    }
    "api" { Start-PythonBackend }
    "frontend" { Start-Frontend }
    "admin" { Start-AdminPortal }
    "clinch" { Start-ClinchCore }
    "reporting" { Start-ClinchReporting }
    "showcase" { Start-Showcase }
}
