param (
    [string]$DbUrl = "db:pg://postgres:postgres@localhost:5432/delivery_app"
)

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
