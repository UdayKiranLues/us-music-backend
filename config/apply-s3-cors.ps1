# PowerShell script to apply S3 CORS configuration
# Run this script to configure CORS for HLS streaming

Write-Host "Applying S3 CORS Configuration..." -ForegroundColor Cyan

# Load environment variables
$envFile = Join-Path $PSScriptRoot "..\\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.+)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

$bucketName = $env:AWS_BUCKET_NAME
$region = $env:AWS_REGION

if (-not $bucketName) {
    Write-Host "Error: AWS_BUCKET_NAME not found in .env file" -ForegroundColor Red
    exit 1
}

if (-not $region) {
    Write-Host "Error: AWS_REGION not found in .env file" -ForegroundColor Red
    exit 1
}

Write-Host "Bucket: $bucketName" -ForegroundColor Yellow
Write-Host "Region: $region" -ForegroundColor Yellow

# Apply CORS configuration
$corsConfig = Join-Path $PSScriptRoot "s3-cors-config.json"

try {
    Write-Host "`nApplying CORS configuration..." -ForegroundColor Cyan
    aws s3api put-bucket-cors --bucket $bucketName --cors-configuration file://$corsConfig --region $region
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ CORS configuration applied successfully!" -ForegroundColor Green
        
        # Verify the configuration
        Write-Host "`nVerifying CORS configuration..." -ForegroundColor Cyan
        aws s3api get-bucket-cors --bucket $bucketName --region $region
        
        Write-Host "`n✅ HLS streaming should now work!" -ForegroundColor Green
        Write-Host "`nNext steps:" -ForegroundColor Yellow
        Write-Host "1. Refresh your browser" -ForegroundColor White
        Write-Host "2. Try playing a song" -ForegroundColor White
        Write-Host "3. Check browser console for CORS errors (should be gone)" -ForegroundColor White
    } else {
        Write-Host "`n❌ Failed to apply CORS configuration" -ForegroundColor Red
        Write-Host "Make sure AWS CLI is installed and configured with correct credentials" -ForegroundColor Yellow
    }
} catch {
    Write-Host "`n❌ Error: $_" -ForegroundColor Red
    Write-Host "`nTroubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Install AWS CLI: https://aws.amazon.com/cli/" -ForegroundColor White
    Write-Host "2. Configure credentials: aws configure" -ForegroundColor White
    Write-Host "3. Verify bucket name and region in .env file" -ForegroundColor White
}
