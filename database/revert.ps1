param (
    [string]$DbUrl = "db:pg://postgres:Q4o1i8L0@localhost:5432/delivery_app"
)

$pgBinDirs = @(
    "C:\Program Files\PostgreSQL\17\bin",
    "C:\Program Files\PostgreSQL\16\bin"
)

foreach ($dir in $pgBinDirs) {
    if (Test-Path $dir) {
        if ($env:PATH -notlike "*$dir*") {
            $env:PATH = "$dir;" + $env:PATH
        }
        break
    }
}

$env:PGPASSWORD = "Q4o1i8L0"

Write-Host "Reverting Sqitch migrations on $DbUrl..." -ForegroundColor Yellow
sqitch revert $DbUrl
