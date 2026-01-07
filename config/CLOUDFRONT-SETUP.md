# AWS CloudFront Setup for HLS Streaming

## Overview

CloudFront CDN provides:
- ✅ **Faster streaming** - Edge locations worldwide
- ✅ **No CORS issues** - Proper headers configured
- ✅ **No DNS errors** - Reliable CloudFront domain
- ✅ **Better scalability** - Cached content at edge
- ✅ **Lower S3 costs** - Reduced S3 requests

---

## Quick Setup (3 Options)

### Option 1: CloudFront with Public Access (Recommended for Development)
- ⚡ **Fastest to setup**
- 🔓 Public HLS files via CloudFront
- ✅ No signed URLs needed
- ⚠️ Anyone with URL can stream (acceptable for music)

### Option 2: CloudFront with Signed URLs (Production)
- 🔐 Secure streaming with time-limited URLs
- ✅ Full control over access
- ⚠️ Requires key pair setup

### Option 3: Direct S3 (Fallback - Not Recommended)
- ⚠️ Slower performance
- ⚠️ Potential CORS issues
- ⚠️ Higher S3 costs

---

## Step-by-Step: CloudFront Setup

### 1. Create CloudFront Distribution

**Via AWS Console:**

1. Go to: https://console.aws.amazon.com/cloudfront/

2. Click **"Create Distribution"**

3. **Origin Settings:**
   ```
   Origin domain: us-music.s3.eu-north-1.amazonaws.com
   Origin path: (leave empty)
   Name: us-music-s3-origin
   ```

4. **Origin Access:**
   - For public access: Select **"Public"**
   - For private: Create **Origin Access Control (OAC)**

5. **Default Cache Behavior:**
   ```
   Viewer protocol policy: Redirect HTTP to HTTPS
   Allowed HTTP methods: GET, HEAD, OPTIONS
   Cache policy: CachingOptimized
   ```

6. **Advanced Settings:**
   ```
   Compress objects automatically: Yes
   Price class: Use all edge locations (or your preference)
   ```

7. Click **"Create Distribution"**

8. **Note the Distribution Domain:**
   ```
   Example: d1a2b3c4d5e6f7.cloudfront.net
   ```

---

### 2. Configure Environment Variables

Add to `.env`:

```env
# CloudFront CDN (required)
CLOUDFRONT_DOMAIN=d1a2b3c4d5e6f7.cloudfront.net

# CloudFront Signed URLs (optional - for private content)
CLOUDFRONT_KEY_PAIR_ID=APKAXXXXXXXXXXXXXXXX
CLOUDFRONT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...your-key...==\n-----END RSA PRIVATE KEY-----"
```

**Note:** If you only set `CLOUDFRONT_DOMAIN`, the system will use **public CloudFront URLs** (no signatures).

---

### 3. Update S3 Bucket Policy (if using OAC)

If you chose Origin Access Control, add this policy to your S3 bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::us-music/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::YOUR_ACCOUNT_ID:distribution/YOUR_DISTRIBUTION_ID"
        }
      }
    }
  ]
}
```

Replace:
- `YOUR_ACCOUNT_ID` with your AWS account ID
- `YOUR_DISTRIBUTION_ID` with your CloudFront distribution ID

---

### 4. Configure CloudFront CORS (Important!)

In CloudFront console, update **Response Headers Policy**:

1. Go to **Policies → Response headers**
2. Create policy or use **CORS-with-preflight-and-SecurityHeadersPolicy**
3. Ensure these headers are set:

```
Access-Control-Allow-Origin: http://localhost:5173, https://yourdomain.com
Access-Control-Allow-Methods: GET, HEAD, OPTIONS
Access-Control-Allow-Headers: *
Access-Control-Max-Age: 3000
```

4. Apply this policy to your distribution's behavior

---

### 5. Wait for Deployment

CloudFront deployment takes **5-15 minutes**.

Check status:
```bash
aws cloudfront get-distribution --id YOUR_DISTRIBUTION_ID --query 'Distribution.Status'
```

Status should be: **"Deployed"**

---

### 6. Test Your Setup

**Test CloudFront URL:**
```bash
curl -I https://YOUR_DISTRIBUTION_DOMAIN.cloudfront.net/songs/test/hls/playlist.m3u8
```

Expected response:
```
HTTP/2 200
content-type: application/vnd.apple.mpegurl
access-control-allow-origin: *
x-cache: Hit from cloudfront
```

---

## Setting Up Signed URLs (Optional - Production)

For private content with time-limited access:

### 1. Create CloudFront Key Pair

**Important:** This requires **root AWS account** access.

1. Sign in to AWS Console with root credentials
2. Go to: https://console.aws.amazon.com/iam/
3. My Security Credentials → CloudFront key pairs
4. Click **"Create New Key Pair"**
5. Download:
   - `private_key.pem` (keep secure!)
   - Note the **Key Pair ID** (APKAXXXXXXXXXXXX)

### 2. Convert Private Key for .env

```bash
# Linux/Mac
cat private_key.pem | sed 's/$/\\n/g' | tr -d '\n'

# Windows PowerShell
(Get-Content private_key.pem -Raw).Replace("`n", "\n")
```

Copy the output to `CLOUDFRONT_PRIVATE_KEY` in `.env`

### 3. Add Key Pair to Distribution

In CloudFront console:
1. Go to your distribution
2. **General → Settings → Edit**
3. **Trusted key groups → Add**
4. Select your key pair
5. Save changes

---

## Troubleshooting

### Issue: "ERR_NAME_NOT_RESOLVED"
- ✅ Check `CLOUDFRONT_DOMAIN` in .env (no https://)
- ✅ Verify distribution is deployed
- ✅ Test DNS: `nslookup YOUR_DISTRIBUTION_DOMAIN.cloudfront.net`

### Issue: "Access Denied" / 403 Error
- ✅ Check S3 bucket policy (if using OAC)
- ✅ Verify origin access settings
- ✅ Ensure files exist in S3: `aws s3 ls s3://us-music/songs/`

### Issue: CORS Errors
- ✅ Configure Response Headers Policy in CloudFront
- ✅ Add your frontend origin: `http://localhost:5173`
- ✅ Clear browser cache (Ctrl+Shift+Delete)
- ✅ Wait for CloudFront deployment (5-15 min)

### Issue: Songs still use S3 URLs
- ✅ Restart backend server after changing .env
- ✅ Check logs: Should see "✅ Using CloudFront..."
- ✅ Test endpoint: `GET /api/v1/songs/:id/stream`

### Issue: Signed URLs not working
- ✅ Verify `CLOUDFRONT_KEY_PAIR_ID` is correct
- ✅ Check private key format (should have \\n)
- ✅ Ensure key pair is added to distribution
- ✅ Check CloudFront trust settings

---

## Verification Checklist

- [ ] CloudFront distribution created
- [ ] Distribution status: "Deployed"
- [ ] `CLOUDFRONT_DOMAIN` set in .env
- [ ] Backend server restarted
- [ ] Test stream endpoint returns CloudFront URL
- [ ] Browser console shows no CORS errors
- [ ] HLS playlist loads successfully
- [ ] .ts segments load from CloudFront
- [ ] Songs play without errors

---

## Production Checklist

- [ ] Enable CloudFront signed URLs
- [ ] Set up proper key rotation policy
- [ ] Configure CloudFront logging
- [ ] Set up CloudFront WAF (optional)
- [ ] Update allowed origins to production domain
- [ ] Enable CloudFront compression
- [ ] Configure cache TTL for HLS files
- [ ] Set up CloudWatch alarms
- [ ] Test from multiple regions

---

## Environment Variables Reference

```env
# Required: CloudFront domain (without https://)
CLOUDFRONT_DOMAIN=d1a2b3c4d5e6f7.cloudfront.net

# Optional: For signed URLs (production security)
CLOUDFRONT_KEY_PAIR_ID=APKAXXXXXXXXXXXXXXXX
CLOUDFRONT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."

# S3 Configuration (still required for uploads)
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=eu-north-1
AWS_BUCKET_NAME=us-music
```

---

## URL Priority Logic

The backend automatically chooses the best streaming method:

1. **CloudFront Signed URL** (if `CLOUDFRONT_DOMAIN` + keys configured)
   - Most secure
   - Best performance
   - Time-limited access

2. **CloudFront Public URL** (if only `CLOUDFRONT_DOMAIN` configured)
   - Good performance
   - No signature overhead
   - Suitable for public music streaming

3. **S3 Presigned URL** (fallback)
   - Slower
   - Higher costs
   - Potential CORS issues

---

## Cost Optimization

### CloudFront Pricing (Approximate)
- First 10 TB/month: $0.085 per GB
- Next 40 TB/month: $0.080 per GB
- Data transfer to origin: Free

### S3 Pricing (Approximate)
- Storage: $0.023 per GB/month
- GET requests: $0.0004 per 1,000 requests
- Data transfer out: $0.09 per GB

**With CloudFront:**
- ✅ 50-90% reduction in S3 data transfer
- ✅ 80-95% reduction in S3 GET requests
- ✅ Better user experience
- ✅ Lower latency worldwide

**Example:** 1000 song streams/day = ~$5/month with CloudFront vs ~$20/month S3 only

---

## Support

For AWS CloudFront help:
- Documentation: https://docs.aws.amazon.com/cloudfront/
- Pricing: https://aws.amazon.com/cloudfront/pricing/
- AWS Support: https://console.aws.amazon.com/support/

For application issues:
- Check backend logs: `npm run dev` (in backend folder)
- Check browser console (F12)
- Verify .env configuration
