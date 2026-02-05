import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
dotenv.config();

const config = {
    aws: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1',
        s3Bucket: process.env.AWS_S3_BUCKET || 'us-music',
    }
};

async function testS3() {
    console.log('Testing S3 with config:', {
        region: config.aws.region,
        bucket: config.aws.s3Bucket,
        accessKeyId: config.aws.accessKeyId ? 'PRESENT' : 'MISSING'
    });

    const s3Client = new S3Client({
        region: config.aws.region,
        credentials: {
            accessKeyId: config.aws.accessKeyId,
            secretAccessKey: config.aws.secretAccessKey,
        },
    });

    try {
        const command = new ListObjectsV2Command({
            Bucket: config.aws.s3Bucket,
            MaxKeys: 5,
        });
        const response = await s3Client.send(command);
        console.log('✅ S3 Connection Success!');
        console.log('Objects found:', response.Contents?.map(obj => obj.Key) || 'None');
    } catch (error) {
        console.error('❌ S3 Connection Failed:', error.message);
    }
}

testS3();
