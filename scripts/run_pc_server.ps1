param(
    [int]$Port = 8000,
    [double]$RefreshMinutes = 0,
    [switch]$BuildOnStart
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root

if (-not (Test-Path ".venv")) {
    python -m venv .venv
}

.\.venv\Scripts\python.exe -m pip install -r requirements.txt

$Args = @(
    "-m", "stock_finder.cli", "serve",
    "--host", "0.0.0.0",
    "--port", "$Port",
    "--refresh-minutes", "$RefreshMinutes"
)

if ($BuildOnStart) {
    $Args += "--build-on-start"
}

.\.venv\Scripts\python.exe @Args
