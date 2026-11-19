param (
    [string]$DbUrl = "db:pg://postgres:Q4o1i8L0@localhost:5432/delivery_app"
)

# Ensure psql / createdb are in the current session PATH for Sqitch
$pgBinDirs = @(
    "C:\Program Files\PostgreSQL\17\bin",
    "C:\Program Files\PostgreSQL\16\bin"
)

foreach ($dir in $pgBinDirs) {
    if (Test-Path $dir) {
        if ($env:PATH -notlike "*$dir*") {
            $env:PATH = "$dir;" + $env:PATH
        }
        $createdb = Join-Path $dir "createdb.exe"
        if (Test-Path $createdb) {
            $env:PGPASSWORD = "Q4o1i8L0"
            & $createdb -U postgres -h localhost -p 5432 delivery_app 2>$null
        }
        break
    }
}

$env:PGPASSWORD = "Q4o1i8L0"

Write-Host "Deploying Sqitch migrations to $DbUrl..." -ForegroundColor Cyan
sqitch deploy $DbUrl

if ($LASTEXITCODE -eq 0) {
    Write-Host "Verifying Sqitch migrations..." -ForegroundColor Cyan
    sqitch verify $DbUrl
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Migrations successfully deployed and verified!" -ForegroundColor Green
    } else {
        Write-Host "Verification failed." -ForegroundColor Red
    }
} else {
    Write-Host "Deployment failed." -ForegroundColor Red
}
