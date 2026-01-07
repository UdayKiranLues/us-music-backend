# PowerShell script to test upload with admin user
# Usage: .\scripts\testUploadPowerShell.ps1 <audio-file> [cover-file]

param(
    [Parameter(Mandatory=$true)]
    [string]$AudioFile,
    
    [Parameter(Mandatory=$false)]
    [string]$CoverFile = ""
)

$PORT = 5000
$API_URL = "http://localhost:$PORT/api/v1"

# Admin credentials
$ADMIN_EMAIL = "admin@usmusic.com"
$ADMIN_PASSWORD = "Admin123456"

Write-Host "🚀 Starting upload test...`n" -ForegroundColor Cyan

# Check if audio file exists
if (-not (Test-Path $AudioFile)) {
    Write-Host "❌ Audio file not found: $AudioFile" -ForegroundColor Red
    exit 1
}

Write-Host "🔐 Logging in as admin..." -ForegroundColor Yellow

# Step 1: Login
$loginBody = @{
    email = $ADMIN_EMAIL
    password = $ADMIN_PASSWORD
} | ConvertTo-Json

try {
    $loginResponse = Invoke-WebRequest -Uri "$API_URL/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody `
        -SessionVariable session

    Write-Host "✅ Login successful!`n" -ForegroundColor Green

    # Step 2: Upload song
    Write-Host "📤 Uploading song..." -ForegroundColor Yellow
    Write-Host "Audio: $AudioFile" -ForegroundColor Gray
    if ($CoverFile) {
        Write-Host "Cover: $CoverFile" -ForegroundColor Gray
    }

    # Prepare multipart form data
    $boundary = [System.Guid]::NewGuid().ToString()
    $LF = "`r`n"
    
    $bodyLines = @()
    
    # Add audio file
    $audioFileName = Split-Path $AudioFile -Leaf
    $audioContent = [System.IO.File]::ReadAllBytes($AudioFile)
    $audioEncoded = [System.Text.Encoding]::GetEncoding('iso-8859-1').GetString($audioContent)
    
    $bodyLines += "--$boundary"
    $bodyLines += "Content-Disposition: form-data; name=`"audio`"; filename=`"$audioFileName`""
    $bodyLines += "Content-Type: audio/mpeg"
    $bodyLines += ""
    $bodyLines += $audioEncoded
    
    # Add cover file if provided
    if ($CoverFile -and (Test-Path $CoverFile)) {
        $coverFileName = Split-Path $CoverFile -Leaf
        $coverContent = [System.IO.File]::ReadAllBytes($CoverFile)
        $coverEncoded = [System.Text.Encoding]::GetEncoding('iso-8859-1').GetString($coverContent)
        
        $bodyLines += "--$boundary"
        $bodyLines += "Content-Disposition: form-data; name=`"cover`"; filename=`"$coverFileName`""
        $bodyLines += "Content-Type: image/jpeg"
        $bodyLines += ""
        $bodyLines += $coverEncoded
    }
    
    # Add metadata fields
    $metadata = @{
        title = "Test Song"
        artist = "Test Artist"
        genre = "Pop"
        mood = "Happy"
        bpm = "128"
        language = "English"
    }
    
    foreach ($key in $metadata.Keys) {
        $bodyLines += "--$boundary"
        $bodyLines += "Content-Disposition: form-data; name=`"$key`""
        $bodyLines += ""
        $bodyLines += $metadata[$key]
    }
    
    $bodyLines += "--$boundary--"
    
    $body = $bodyLines -join $LF
    
    $uploadResponse = Invoke-WebRequest -Uri "$API_URL/upload/song-with-cover" `
        -Method POST `
        -ContentType "multipart/form-data; boundary=$boundary" `
        -Body $body `
        -WebSession $session

    $result = $uploadResponse.Content | ConvertFrom-Json
    
    Write-Host "`n✅ Upload successful!" -ForegroundColor Green
    Write-Host "📋 Song details:" -ForegroundColor Cyan
    Write-Host ($result | ConvertTo-Json -Depth 5) -ForegroundColor Gray
    
    Write-Host "`n✅ Test completed successfully!" -ForegroundColor Green

} catch {
    Write-Host "`n❌ Test failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $errorBody = $reader.ReadToEnd()
        Write-Host "Error details: $errorBody" -ForegroundColor Red
    }
    exit 1
}
