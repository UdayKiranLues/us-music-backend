# Test CloudFront Configuration
# Run: powershell -ExecutionPolicy Bypass -File config/test-cloudfront.ps1

Write-Host "`n════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  CloudFront Configuration Test" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

# Load environment variables
$envFile = Join-Path $PSScriptRoot "..\\.env"
if (Test-Path $envFile) {
    Write-Host "✅ Loading .env file..." -ForegroundColor Green
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.+)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
} else {
    Write-Host "❌ .env file not found at: $envFile" -ForegroundColor Red
    exit 1
}

$cloudFrontDomain = $env:CLOUDFRONT_DOMAIN
$cloudFrontKeyId = $env:CLOUDFRONT_KEY_PAIR_ID
$cloudFrontKey = $env:CLOUDFRONT_PRIVATE_KEY
$s3Bucket = $env:AWS_BUCKET_NAME
$awsRegion = $env:AWS_REGION

Write-Host "Configuration Check:" -ForegroundColor Yellow
Write-Host "────────────────────────────────────────────────────────────" -ForegroundColor Gray

# Check CloudFront Domain
if ($cloudFrontDomain) {
    Write-Host "✅ CLOUDFRONT_DOMAIN: $cloudFrontDomain" -ForegroundColor Green
    
    # Test CloudFront domain accessibility
    Write-Host "`n   Testing CloudFront domain..." -ForegroundColor Cyan
    try {
        $testUrl = "https://$cloudFrontDomain"
        $response = Invoke-WebRequest -Uri $testUrl -Method Head -ErrorAction Stop -TimeoutSec 10
        Write-Host "   ✅ CloudFront domain is accessible" -ForegroundColor Green
        Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
    } catch {
        Write-Host "   ⚠️  CloudFront domain test: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "   Note: This is OK if you haven't uploaded files yet" -ForegroundColor Gray
    }
} else {
    Write-Host "⚠️  CLOUDFRONT_DOMAIN: Not configured" -ForegroundColor Yellow
    Write-Host "   → System will use S3 URLs (slower, potential CORS issues)" -ForegroundColor Gray
    Write-Host "   → Recommended: Set up CloudFront (see CLOUDFRONT-SETUP.md)" -ForegroundColor Gray
}

# Check CloudFront Signed URLs
if ($cloudFrontKeyId -and $cloudFrontKey) {
    Write-Host "✅ CLOUDFRONT_KEY_PAIR_ID: Configured" -ForegroundColor Green
    Write-Host "✅ CLOUDFRONT_PRIVATE_KEY: Configured" -ForegroundColor Green
    Write-Host "   → Signed URLs enabled (secure, time-limited access)" -ForegroundColor Gray
} elseif ($cloudFrontDomain) {
    Write-Host "ℹ️  CloudFront Signed URLs: Not configured" -ForegroundColor Cyan
    Write-Host "   → Using public CloudFront URLs" -ForegroundColor Gray
    Write-Host "   → This is fine for music streaming" -ForegroundColor Gray
}

# Check S3 Configuration
Write-Host "`nS3 Configuration:" -ForegroundColor Yellow
Write-Host "────────────────────────────────────────────────────────────" -ForegroundColor Gray
if ($s3Bucket) {
    Write-Host "✅ AWS_BUCKET_NAME: $s3Bucket" -ForegroundColor Green
} else {
    Write-Host "❌ AWS_BUCKET_NAME: Not configured" -ForegroundColor Red
}

if ($awsRegion) {
    Write-Host "✅ AWS_REGION: $awsRegion" -ForegroundColor Green
} else {
    Write-Host "❌ AWS_REGION: Not configured" -ForegroundColor Red
}

# Streaming Strategy
Write-Host "`nStreaming Strategy:" -ForegroundColor Yellow
Write-Host "────────────────────────────────────────────────────────────" -ForegroundColor Gray

if ($cloudFrontDomain -and $cloudFrontKeyId -and $cloudFrontKey) {
    Write-Host "🔐 CloudFront Signed URLs (Best)" -ForegroundColor Green
    Write-Host "   ✅ CDN acceleration" -ForegroundColor Gray
    Write-Host "   ✅ Secure with time-limited access" -ForegroundColor Gray
    Write-Host "   ✅ No CORS issues" -ForegroundColor Gray
} elseif ($cloudFrontDomain) {
    Write-Host "🌐 CloudFront Public URLs (Good)" -ForegroundColor Green
    Write-Host "   ✅ CDN acceleration" -ForegroundColor Gray
    Write-Host "   ✅ No CORS issues" -ForegroundColor Gray
    Write-Host "   ℹ️  Public access (fine for music)" -ForegroundColor Gray
} else {
    Write-Host "⚠️  S3 Presigned URLs (Fallback)" -ForegroundColor Yellow
    Write-Host "   ⚠️  Slower performance" -ForegroundColor Gray
    Write-Host "   ⚠️  Potential CORS issues" -ForegroundColor Gray
    Write-Host "   ⚠️  Higher S3 costs" -ForegroundColor Gray
}

# Recommendations
Write-Host "`nRecommendations:" -ForegroundColor Yellow
Write-Host "────────────────────────────────────────────────────────────" -ForegroundColor Gray

if (-not $cloudFrontDomain) {
    Write-Host "📋 Set up CloudFront for better streaming:" -ForegroundColor Cyan
    Write-Host "   1. See: backend/config/CLOUDFRONT-QUICKSTART.txt" -ForegroundColor White
    Write-Host "   2. Create CloudFront distribution" -ForegroundColor White
    Write-Host "   3. Add CLOUDFRONT_DOMAIN to .env" -ForegroundColor White
    Write-Host "   4. Restart backend server" -ForegroundColor White
} else {
    Write-Host "✅ CloudFront configured correctly!" -ForegroundColor Green
    Write-Host "   → Streaming should work without issues" -ForegroundColor Gray
    
    if (-not ($cloudFrontKeyId -and $cloudFrontKey)) {
        Write-Host "`n   Optional: Enable signed URLs for production" -ForegroundColor Cyan
        Write-Host "   → See: backend/config/CLOUDFRONT-SETUP.md" -ForegroundColor Gray
    }
}

Write-Host "`n════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Test complete!" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan
