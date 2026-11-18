param (
    [string]$DbUrl = "db:pg://postgres:postgres@localhost:5432/delivery_app"
)

Write-Host "Reverting Sqitch migrations on $DbUrl..." -ForegroundColor Yellow
sqitch revert $DbUrl
