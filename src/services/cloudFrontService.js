import { getSignedUrl } from '@aws-sdk/cloudfront-signer';
import config from '../config/index.js';
import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';

/**
 * CloudFront Service for generating signed URLs
 * Provides secure, time-limited access to private S3 content via CloudFront CDN
 */

class CloudFrontService {
  constructor() {
    this.distributionDomain = config.aws.cloudFrontDomain;
    this.keyPairId = config.aws.cloudFrontKeyPairId;
    this.privateKey = config.aws.cloudFrontPrivateKey;
    this.defaultExpiration = 3600; // 1 hour in seconds
  }

  /**
   * Generate signed CloudFront URL for HLS playlist
   * @param {string} s3Key - S3 object key (e.g., 'songs/songId/hls/playlist.m3u8')
   * @param {number} expirationSeconds - URL validity duration
   * @returns {string} Signed CloudFront URL
   */
  async getSignedHLSUrl(s3Key, expirationSeconds = this.defaultExpiration) {
    try {
      if (!this.distributionDomain || !this.keyPairId || !this.privateKey) {
        logger.warn('CloudFront not configured, falling back to S3 URLs');
        return null;
      }

      // CloudFront URL
      const url = `https://${this.distributionDomain}/${s3Key}`;
      
      // Calculate expiration timestamp
      const dateExpires = new Date(Date.now() + expirationSeconds * 1000);

      // Generate signed URL
      const signedUrl = getSignedUrl({
        url,
        keyPairId: this.keyPairId,
        privateKey: this.privateKey,
        dateLessThan: dateExpires.toISOString(),
      });

      logger.debug(`Generated signed URL for ${s3Key}, expires: ${dateExpires.toISOString()}`);
      return signedUrl;
    } catch (error) {
      logger.error('Failed to generate signed CloudFront URL:', error);
      throw new AppError('Failed to generate secure streaming URL', 500);
    }
  }

  /**
   * Generate signed URLs for entire HLS playlist including all segments
   * @param {string} songId - Song identifier
   * @param {Array<string>} segments - List of segment filenames
   * @param {number} expirationSeconds - URL validity duration
   * @returns {Object} Object containing signed playlist URL and segment URLs
   */
  async getSignedHLSPlaylist(songId, segments, expirationSeconds = this.defaultExpiration) {
    try {
      const playlistKey = `songs/${songId}/hls/playlist.m3u8`;
      
      // Generate signed URL for playlist
      const playlistUrl = await this.getSignedHLSUrl(playlistKey, expirationSeconds);

      // Generate signed URLs for all segments
      const segmentUrls = await Promise.all(
        segments.map(segment => {
          const segmentKey = `songs/${songId}/hls/${segment}`;
          return this.getSignedHLSUrl(segmentKey, expirationSeconds);
        })
      );

      return {
        playlistUrl,
        segments: segments.map((segment, index) => ({
          name: segment,
          url: segmentUrls[index],
        })),
        expiresAt: new Date(Date.now() + expirationSeconds * 1000),
      };
    } catch (error) {
      logger.error('Failed to generate signed HLS playlist:', error);
      throw new AppError('Failed to generate secure playlist', 500);
    }
  }

  /**
   * Generate signed URL for cover image
   * @param {string} s3Key - S3 object key for cover image
   * @param {number} expirationSeconds - URL validity duration
   * @returns {string} Signed CloudFront URL
   */
  async getSignedImageUrl(s3Key, expirationSeconds = 86400) { // 24 hours default
    try {
      return await this.getSignedHLSUrl(s3Key, expirationSeconds);
    } catch (error) {
      logger.error('Failed to generate signed image URL:', error);
      throw new AppError('Failed to generate secure image URL', 500);
    }
  }

  /**
   * Check if CloudFront is properly configured
   * @returns {boolean} Configuration status
   */
  isConfigured() {
    return !!(this.distributionDomain && this.keyPairId && this.privateKey);
  }

  /**
   * Check if CloudFront domain is configured (for public URLs)
   * @returns {boolean} Domain configuration status
   */
  isDomainConfigured() {
    return !!this.distributionDomain;
  }

  /**
   * Generate public CloudFront URL (no signature required)
   * Use this when CloudFront distribution allows public access
   * @param {string} s3Key - S3 object key (e.g., 'songs/songId/hls/playlist.m3u8')
   * @returns {string} Public CloudFront URL
   */
  getPublicUrl(s3Key) {
    if (!this.distributionDomain) {
      logger.warn('CloudFront domain not configured');
      return null;
    }

    // Remove leading slash if present
    const key = s3Key.startsWith('/') ? s3Key.substring(1) : s3Key;
    
    // Build CloudFront URL
    const url = `https://${this.distributionDomain}/${key}`;
    
    logger.debug(`Generated public CloudFront URL for ${key}`);
    return url;
  }

  /**
   * Get CloudFront distribution domain
   * @returns {string} Distribution domain
   */
  getDistributionDomain() {
    return this.distributionDomain;
  }

  /**
   * Generate policy statement for custom signed URLs with IP restrictions
   * @param {string} url - Resource URL
   * @param {number} expirationSeconds - URL validity duration
   * @param {string} ipAddress - Optional IP address restriction
   * @returns {string} Signed URL with policy
   */
  async getSignedUrlWithPolicy(url, expirationSeconds = this.defaultExpiration, ipAddress = null) {
    try {
      const dateExpires = new Date(Date.now() + expirationSeconds * 1000);
      
      const policy = {
        Statement: [
          {
            Resource: url,
            Condition: {
              DateLessThan: {
                'AWS:EpochTime': Math.floor(dateExpires.getTime() / 1000),
              },
              ...(ipAddress && {
                IpAddress: {
                  'AWS:SourceIp': ipAddress,
                },
              }),
            },
          },
        ],
      };

      const signedUrl = getSignedUrl({
        url,
        keyPairId: this.keyPairId,
        privateKey: this.privateKey,
        policy: JSON.stringify(policy),
      });

      return signedUrl;
    } catch (error) {
      logger.error('Failed to generate signed URL with policy:', error);
      throw new AppError('Failed to generate secure URL', 500);
    }
  }

  /**
   * Get remaining time until URL expires
   * @param {string} signedUrl - CloudFront signed URL
   * @returns {number} Seconds until expiration
   */
  getTimeUntilExpiration(signedUrl) {
    try {
      const url = new URL(signedUrl);
      const expires = url.searchParams.get('Expires');
      
      if (!expires) {
        return 0;
      }

      const expirationTime = parseInt(expires) * 1000;
      const currentTime = Date.now();
      const remainingTime = Math.max(0, Math.floor((expirationTime - currentTime) / 1000));

      return remainingTime;
    } catch (error) {
      logger.error('Failed to parse expiration time:', error);
      return 0;
    }
  }

  /**
   * Check if signed URL needs refresh (less than 5 minutes remaining)
   * @param {string} signedUrl - CloudFront signed URL
   * @returns {boolean} True if refresh needed
   */
  needsRefresh(signedUrl) {
    const remainingTime = this.getTimeUntilExpiration(signedUrl);
    return remainingTime < 300; // Refresh if less than 5 minutes remaining
  }
}

// Export singleton instance
export default new CloudFrontService();
