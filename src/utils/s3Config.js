const { S3Client } = require('@aws-sdk/client-s3');

// Initialize S3 client with fallback credentials and region
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const S3_BUCKET = process.env.S3_BUCKET_NAME || 'ai-test-portal';

module.exports = {
  s3Client,
  S3_BUCKET
};
