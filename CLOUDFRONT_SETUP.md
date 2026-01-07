# CloudFront CDN Setup Guide
## Secure HLS Streaming with CloudFront Signed URLs

This guide covers setting up AWS CloudFront distribution for secure, high-performance music streaming.

---

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step-by-Step Setup](#step-by-step-setup)
4. [Configuration](#configuration)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)

---

## Overview

### Why CloudFront?
- **Performance**: Edge caching reduces latency by 60-80%
- **Security**: Private S3 bucket with signed URLs prevents unauthorized access
- **Scalability**: Handles millions of concurrent streams
- **Cost**: Reduces S3 data transfer costs by 30-50%

### Architecture
```
User Request → CloudFront Edge → Origin Access Identity → Private S3 Bucket
              ↓ (signed URL)
         Backend generates time-limited signed URL
```

---

## Prerequisites

- AWS Account with appropriate permissions
- S3 bucket with HLS content (`us-music-audio`)
- Backend running with AWS SDK v3
- Node.js 18+ installed

---

## Step-by-Step Setup

### 1. Create CloudFront Key Pair

CloudFront signed URLs require a trusted key pair.

```bash
# Generate RSA private key
openssl genrsa -out cloudfront-private-key.pem 2048

# Generate public key
openssl rsa -pubout -in cloudfront-private-key.pem -out cloudfront-public-key.pem
```

**Important**: Store the private key securely - never commit to git!

### 2. Add CloudFront Public Key to AWS

1. Go to AWS Console → CloudFront → Key Management → Public Keys
2. Click "Create Public Key"
3. Name: `us-music-cloudfront-key`
4. Paste contents of `cloudfront-public-key.pem`
5. Click "Create"
6. **Save the Key Pair ID** (e.g., `APKAXXXXXXXXXXXXXXXX`)

### 3. Create Key Group

1. Go to CloudFront → Key Management → Key Groups
2. Click "Create Key Group"
3. Name: `us-music-key-group`
4. Add the public key created in step 2
5. Click "Create"

### 4. Configure S3 Bucket

Make S3 bucket **private** (remove public access):

```bash
# Remove public access
aws s3api put-bucket-acl --bucket us-music-audio --acl private

# Block public access
aws s3api put-public-access-block \
  --bucket us-music-audio \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

### 5. Create Origin Access Identity (OAI)

1. Go to CloudFront → Origin Access Identity
2. Click "Create Origin Access Identity"
3. Name: `us-music-oai`
4. Click "Create"
5. **Save the OAI ID** (e.g., `E1XXXXXXXXXX`)

### 6. Update S3 Bucket Policy

Add policy to allow CloudFront OAI access:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontOAI",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity YOUR_OAI_ID"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::us-music-audio/*"
    }
  ]
}
```

Replace `YOUR_OAI_ID` with the OAI ID from step 5.

### 7. Create CloudFront Distribution

1. Go to CloudFront → Distributions → Create Distribution
2. **Origin Settings**:
   - Origin Domain: `us-music-audio.s3.us-east-1.amazonaws.com`
   - Origin Path: (leave empty)
   - Origin Access: Legacy access identities
   - Origin Access Identity: Select the OAI created in step 5
   
3. **Default Cache Behavior**:
   - Viewer Protocol Policy: **Redirect HTTP to HTTPS**
   - Allowed HTTP Methods: GET, HEAD, OPTIONS
   - Restrict Viewer Access: **Yes**
   - Trusted Key Groups: Select the key group from step 3
   - Cache Policy: **CachingOptimized**
   - Origin Request Policy: **CORS-S3Origin**
   
4. **Cache Behaviors** (Add 2 custom behaviors):

   **Behavior 1: HLS Playlists (.m3u8)**
   - Path Pattern: `*.m3u8`
   - Cache Policy: Create custom:
     - TTL: Min 0, Default 5, Max 300 (5 minutes)
     - Headers: Origin, Access-Control-Request-Headers, Access-Control-Request-Method
   - Viewer Protocol: HTTPS Only
   - Trusted Key Groups: us-music-key-group
   
   **Behavior 2: HLS Segments (.ts)**
   - Path Pattern: `*.ts`
   - Cache Policy: Create custom:
     - TTL: Min 86400, Default 86400, Max 31536000 (24 hours to 1 year)
   - Viewer Protocol: HTTPS Only
   - Trusted Key Groups: us-music-key-group

5. **Distribution Settings**:
   - Price Class: Use all edge locations (best performance)
   - Alternate Domain Names (CNAMEs): `cdn.yourdomain.com` (optional)
   - SSL Certificate: CloudFront default or custom
   
6. Click "Create Distribution"
7. **Wait 10-15 minutes** for deployment
8. **Save the Distribution Domain** (e.g., `d1234567890.cloudfront.net`)

### 8. Configure Backend Environment

Update `.env` file:

```env
# CloudFront CDN Configuration
CLOUDFRONT_DOMAIN=d1234567890.cloudfront.net
CLOUDFRONT_KEY_PAIR_ID=APKAXXXXXXXXXXXXXXXX
CLOUDFRONT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nYourPrivateKeyHere\n-----END RSA PRIVATE KEY-----"
```

**For multi-line private key**:
```bash
# Convert private key to single line
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' cloudfront-private-key.pem
```

---

## Configuration

### Backend Configuration

The backend is already configured to support CloudFront. Key files:

- `backend/src/services/cloudFrontService.js` - Signed URL generation
- `backend/src/utils/s3.js` - S3 upload with CloudFront integration
- `backend/src/config/index.js` - CloudFront settings
- `backend/src/controllers/songController.js` - `/songs/:id/stream` endpoint

### Signed URL Expiration

Default: **1 hour** (3600 seconds)

Customize in `cloudFrontService.js`:
```javascript
this.defaultExpiration = 3600; // seconds
```

### URL Refresh

Frontend automatically refreshes signed URLs **5 minutes before expiration** via `PlayerContext.jsx`.

---

## Testing

### 1. Test S3 Upload (Private)

```bash
cd backend
node scripts/testUpload.js
```

Expected: Song uploaded, no public access, streaming works via signed URLs.

### 2. Test Signed URL Generation

```bash
# Get auth token
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Get signed streaming URL
curl -X GET http://localhost:5000/api/v1/songs/{SONG_ID}/stream \
  -H "Authorization: Bearer {TOKEN}"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "streamUrl": "https://d1234567890.cloudfront.net/songs/.../playlist.m3u8?Expires=...&Signature=...&Key-Pair-Id=...",
    "expiresAt": "2024-01-07T10:30:00.000Z",
    "expiresIn": 3600,
    "cdnEnabled": true
  }
}
```

### 3. Test Frontend Playback

```bash
cd ../
npm run dev
```

1. Login as user
2. Play a song
3. Open browser DevTools → Network tab
4. Verify requests go to CloudFront domain (not S3)
5. Check for `Expires`, `Signature`, `Key-Pair-Id` parameters in URLs

### 4. Test Security

**Test 1: Direct S3 Access (should fail)**
```bash
curl https://us-music-audio.s3.us-east-1.amazonaws.com/songs/123/hls/playlist.m3u8
```
Expected: `403 Forbidden`

**Test 2: CloudFront without signature (should fail)**
```bash
curl https://d1234567890.cloudfront.net/songs/123/hls/playlist.m3u8
```
Expected: `403 Forbidden` (MissingKey error)

**Test 3: Valid signed URL (should work)**
```bash
# Use URL from /songs/:id/stream endpoint
curl "https://d1234567890.cloudfront.net/songs/123/hls/playlist.m3u8?Expires=...&Signature=...&Key-Pair-Id=..."
```
Expected: `200 OK` with HLS playlist content

---

## Troubleshooting

### Issue: 403 Forbidden on CloudFront

**Possible Causes**:
1. Key Pair ID incorrect in `.env`
2. Private key not matching public key in AWS
3. Key Group not assigned to distribution behavior
4. Signed URL expired

**Solution**:
```bash
# Verify key pair ID
echo $CLOUDFRONT_KEY_PAIR_ID

# Check distribution settings
aws cloudfront get-distribution-config --id {DISTRIBUTION_ID}

# Regenerate signed URL
curl http://localhost:5000/api/v1/songs/{SONG_ID}/stream \
  -H "Authorization: Bearer {TOKEN}"
```

### Issue: CORS Errors

**Solution**:
Add CORS policy to S3 bucket:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["Content-Length", "Content-Range"]
  }
]
```

Apply via AWS CLI:
```bash
aws s3api put-bucket-cors \
  --bucket us-music-audio \
  --cors-configuration file://cors.json
```

### Issue: HLS Playback Stuttering

**Possible Causes**:
1. Cache TTL too short for `.ts` segments
2. Origin request policy not optimized
3. Price class limiting edge locations

**Solution**:
1. Increase `.ts` segment cache TTL to 24 hours
2. Use `CachingOptimized` cache policy
3. Use "Use all edge locations" price class

### Issue: High CloudFront Costs

**Optimization**:
1. Enable compression (gzip/brotli) for playlists
2. Increase cache TTL for segments
3. Use regional edge caches
4. Monitor CloudFront reports for cache hit ratio (target >85%)

```bash
# Check cache statistics
aws cloudfront get-distribution-config --id {DIST_ID} \
  | jq '.DistributionConfig.DefaultCacheBehavior'
```

### Issue: Private Key Not Loading

**Solution**:
Ensure private key is properly formatted in `.env`:

```bash
# Format for .env (single line with \n)
CLOUDFRONT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----"

# Verify in Node.js
node -e "console.log(process.env.CLOUDFRONT_PRIVATE_KEY.replace(/\\\\n/g, '\\n'))"
```

---

## Performance Optimization

### 1. Enable HTTP/2 and HTTP/3

CloudFront supports HTTP/2 by default. Enable HTTP/3 for better mobile performance:

1. Go to Distribution Settings
2. Enable "Supported HTTP Versions": HTTP/3, HTTP/2, HTTP/1.1

### 2. Custom Domain with SSL

```bash
# Request ACM certificate in us-east-1
aws acm request-certificate \
  --domain-name cdn.yourdomain.com \
  --validation-method DNS \
  --region us-east-1
```

Add CNAME to distribution and configure custom SSL.

### 3. Monitor Performance

```bash
# CloudFront cache hit ratio (target >85%)
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name CacheHitRate \
  --dimensions Name=DistributionId,Value={DIST_ID} \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-07T00:00:00Z \
  --period 3600 \
  --statistics Average
```

---

## Security Best Practices

1. **Rotate Keys**: Rotate CloudFront key pairs every 90 days
2. **Monitor Access**: Enable CloudFront access logs
3. **Restrict Origins**: Use OAI, never public S3 buckets
4. **Short TTL**: Keep signed URL expiration ≤ 1 hour
5. **HTTPS Only**: Enforce HTTPS for all connections
6. **IP Restrictions**: (Optional) Add IP-based restrictions for admin content

---

## Fallback to S3 Presigned URLs

If CloudFront is not configured, the backend automatically falls back to S3 presigned URLs:

```javascript
// backend/src/utils/s3.js
if (cloudFrontService.isConfigured()) {
  return await cloudFrontService.getSignedHLSUrl(s3Key);
} else {
  return await getSignedS3Url(s3Key); // Fallback
}
```

This ensures the system works with or without CloudFront.

---

## Cost Estimate

### With CloudFront (Recommended)
- **Storage (S3)**: $0.023/GB/month
- **CloudFront Transfer**: $0.085/GB (first 10 TB)
- **CloudFront Requests**: $0.0075 per 10,000 requests

**Example**: 10,000 songs, 100,000 streams/month
- Storage: 500 GB × $0.023 = **$11.50/month**
- Transfer: 5 TB × $0.085 = **$425/month**
- Requests: 100K × 10 segments × $0.0075/10K = **$7.50/month**
- **Total**: **~$444/month**

### Without CloudFront (S3 Direct)
- **Storage**: $0.023/GB/month
- **Data Transfer Out**: $0.09/GB (first 10 TB)
- **GET Requests**: $0.0004 per 1,000 requests

**Example** (same usage):
- Storage: **$11.50/month**
- Transfer: 5 TB × $0.09 = **$450/month**
- Requests: 1M × $0.0004/1K = **$400/month**
- **Total**: **~$861/month**

**Savings with CloudFront**: **~50%** + better performance!

---

## Next Steps

1. ✅ Complete this CloudFront setup
2. ✅ Test signed URLs end-to-end
3. [ ] Monitor cache hit ratio (target >85%)
4. [ ] Setup CloudWatch alarms for 4xx/5xx errors
5. [ ] Enable CloudFront access logs for analytics
6. [ ] Configure custom domain (optional)
7. [ ] Implement CDN cache invalidation for updated content

---

## Support

- **AWS CloudFront Docs**: https://docs.aws.amazon.com/cloudfront/
- **Signed URLs Guide**: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-urls.html
- **HLS Streaming Best Practices**: https://aws.amazon.com/blogs/media/how-to-secure-and-optimize-hls-streaming/

---

**Last Updated**: January 2024  
**Version**: 1.0.0
