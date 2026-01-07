import axios from 'axios';
import Song from '../models/Song.js';
import config from '../config/index.js';
import cloudFrontService from '../services/cloudFrontService.js';
import logger from '../utils/logger.js';

/**
 * Automated Song Playback Diagnostic Test
 * Tests streaming functionality and configuration
 */
class PlaybackDiagnostic {
  constructor() {
    this.apiUrl = `http://localhost:${config.port}/api/v1`;
  }

  /**
   * Run comprehensive playback diagnostics
   */
  async runDiagnostics() {
    console.log('\n════════════════════════════════════════════════════════');
    console.log('  🔍 SONG PLAYBACK DIAGNOSTIC TEST');
    console.log('════════════════════════════════════════════════════════\n');

    try {
      // Test 1: Configuration Check
      await this.testConfiguration();

      // Test 2: Database Check
      await this.testDatabaseConnection();

      // Test 3: Sample Song Stream
      await this.testSongStream();

      // Test 4: URL Validation
      await this.testUrlValidation();

      console.log('\n════════════════════════════════════════════════════════');
      console.log('  ✅ DIAGNOSTIC TEST COMPLETED');
      console.log('════════════════════════════════════════════════════════\n');
    } catch (error) {
      console.error('\n❌ Diagnostic test failed:', error.message);
    }
  }

  /**
   * Test 1: Configuration Check
   */
  async testConfiguration() {
    console.log('📋 Test 1: Configuration Check');
    console.log('──────────────────────────────────────────────────────────');

    // Check CloudFront
    if (cloudFrontService.isDomainConfigured()) {
      console.log('✅ CloudFront domain configured:', config.aws.cloudFrontDomain);
      
      if (cloudFrontService.isConfigured()) {
        console.log('✅ CloudFront signed URLs enabled');
      } else {
        console.log('ℹ️  CloudFront public URLs (no signatures)');
      }
    } else {
      console.log('⚠️  CloudFront NOT configured');
      console.log('   → Using S3 direct URLs (slower, potential CORS issues)');
      console.log('   → Add CLOUDFRONT_DOMAIN to .env');
    }

    // Check S3
    if (config.aws.s3Bucket) {
      console.log('✅ S3 bucket:', config.aws.s3Bucket);
    } else {
      console.log('❌ S3 bucket NOT configured');
    }

    // Check Region
    if (config.aws.region) {
      console.log('✅ AWS region:', config.aws.region);
    } else {
      console.log('⚠️  AWS region not configured');
    }

    console.log('');
  }

  /**
   * Test 2: Database Connection
   */
  async testDatabaseConnection() {
    console.log('🗄️  Test 2: Database Connection');
    console.log('──────────────────────────────────────────────────────────');

    try {
      const songCount = await Song.countDocuments();
      console.log(`✅ Connected to MongoDB`);
      console.log(`   Total songs in database: ${songCount}`);

      if (songCount === 0) {
        console.log('⚠️  No songs found in database');
        console.log('   → Upload a song to test playback');
      }

      console.log('');
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      console.log('');
      throw error;
    }
  }

  /**
   * Test 3: Sample Song Stream
   */
  async testSongStream() {
    console.log('🎵 Test 3: Stream Endpoint Test');
    console.log('──────────────────────────────────────────────────────────');

    try {
      // Get first song from database
      const song = await Song.findOne().lean();

      if (!song) {
        console.log('⚠️  No songs available to test');
        console.log('');
        return;
      }

      console.log(`   Testing with: "${song.title}" by ${song.artist}`);
      console.log(`   Song ID: ${song._id}`);

      // Test stream endpoint
      const streamUrl = `${this.apiUrl}/songs/${song._id}/stream`;
      console.log(`   Endpoint: ${streamUrl}`);

      const response = await axios.get(streamUrl);

      if (response.data.success) {
        const { streamUrl, cdnType, diagnostic } = response.data.data;
        
        console.log('✅ Stream endpoint responsive');
        console.log(`   CDN Type: ${cdnType}`);
        console.log(`   Stream URL: ${streamUrl.substring(0, 80)}...`);

        // Check URL type
        if (streamUrl.includes('cloudfront.net')) {
          console.log('✅ Using CloudFront (optimal)');
        } else if (streamUrl.includes('s3.amazonaws.com')) {
          console.log('⚠️  Using S3 direct (suboptimal)');
        }

        // Check diagnostics
        if (diagnostic?.warning) {
          console.log('⚠️  Warning:', diagnostic.warning);
        }

        if (diagnostic?.isOptimal === false) {
          console.log('⚠️  Streaming configuration not optimal');
        }

        // Test manifest accessibility (basic check)
        try {
          const manifestResponse = await axios.head(streamUrl, { timeout: 5000 });
          console.log('✅ HLS manifest accessible');
          console.log(`   Status: ${manifestResponse.status}`);
        } catch (error) {
          if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            console.error('❌ Cannot reach manifest URL');
            console.error('   DNS or network error');
          } else {
            console.warn('⚠️  Manifest check inconclusive:', error.message);
          }
        }
      } else {
        console.error('❌ Stream endpoint returned error');
      }

      console.log('');
    } catch (error) {
      console.error('❌ Stream test failed:', error.message);
      
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Error:', error.response.data?.error || error.response.statusText);
        
        if (error.response.data?.diagnostic) {
          console.error('   Diagnostic:', JSON.stringify(error.response.data.diagnostic, null, 2));
        }
      }
      
      console.log('');
    }
  }

  /**
   * Test 4: URL Validation
   */
  async testUrlValidation() {
    console.log('🔗 Test 4: URL Validation Rules');
    console.log('──────────────────────────────────────────────────────────');

    const testUrls = [
      {
        url: 'https://d123.cloudfront.net/songs/abc/hls/playlist.m3u8',
        expected: 'valid',
        type: 'CloudFront',
      },
      {
        url: 'https://bucket.s3.region.amazonaws.com/songs/abc/hls/playlist.m3u8',
        expected: 'invalid',
        type: 'S3 Direct',
      },
      {
        url: 'http://localhost/songs/undefined/stream',
        expected: 'invalid',
        type: 'Undefined ID',
      },
    ];

    testUrls.forEach((test) => {
      const isS3 = test.url.includes('s3.amazonaws.com') || test.url.match(/s3\.[a-z0-9-]+\.amazonaws/);
      const isCloudFront = test.url.includes('cloudfront.net');
      const hasUndefined = test.url.includes('/undefined/');

      let result = 'unknown';
      if (hasUndefined) {
        result = 'invalid';
      } else if (isCloudFront) {
        result = 'valid';
      } else if (isS3) {
        result = 'suboptimal';
      }

      const icon = result === 'valid' ? '✅' : result === 'invalid' ? '❌' : '⚠️';
      console.log(`${icon} ${test.type}:`);
      console.log(`   ${test.url.substring(0, 70)}...`);
      console.log(`   Result: ${result} (expected: ${test.expected})`);
    });

    console.log('');
  }

  /**
   * Run quick test of a specific song ID
   */
  async testSongById(songId) {
    console.log(`\n🎵 Testing song: ${songId}`);
    console.log('──────────────────────────────────────────────────────────');

    try {
      const streamUrl = `${this.apiUrl}/songs/${songId}/stream`;
      const response = await axios.get(streamUrl);

      if (response.data.success) {
        console.log('✅ Stream URL obtained');
        console.log('   URL:', response.data.data.streamUrl);
        console.log('   CDN:', response.data.data.cdnType);
        return response.data.data.streamUrl;
      } else {
        console.error('❌ Failed to get stream URL');
        return null;
      }
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      if (error.response?.data?.diagnostic) {
        console.error('   Diagnostic:', error.response.data.diagnostic);
      }
      return null;
    }
  }
}

// Export singleton
export default new PlaybackDiagnostic();

/**
 * Auto-run diagnostics in development mode
 */
export const runDiagnosticsOnStartup = async () => {
  if (config.isDevelopment) {
    // Wait for server to be fully ready
    setTimeout(async () => {
      const diagnostic = new PlaybackDiagnostic();
      await diagnostic.runDiagnostics();
    }, 2000);
  }
};
