const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client, S3_BUCKET } = require('../utils/s3Config');
const path = require('path');

class S3Service {
  /**
   * Upload file to S3
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} originalName - Original filename
   * @param {string} mimeType - File MIME type
   * @param {string} folder - S3 folder (default: 'resumes')
   * @returns {Promise<Object>} Upload result
   */
  async uploadFile(fileBuffer, originalName, mimeType, folder = 'resumes') {
    try {
      // Generate unique filename
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const extension = path.extname(originalName);
      const uniqueFileName = `${folder}/${timestamp}_${randomString}${extension}`;
      
      const uploadParams = {
        Bucket: S3_BUCKET,
        Key: uniqueFileName,
        Body: fileBuffer,
        ContentType: mimeType,
        ContentDisposition: 'inline',
        ServerSideEncryption: 'AES256',
        Metadata: {
          originalName: originalName,
          uploadDate: new Date().toISOString()
        }
      };

      const command = new PutObjectCommand(uploadParams);
      const result = await s3Client.send(command);
      
      // Construct the public URL
      const fileUrl = `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${uniqueFileName}`;
      
      return {
        success: true,
        fileUrl,
        s3Key: uniqueFileName,
        originalName,
        etag: result.ETag,
        bucket: S3_BUCKET
      };
    } catch (error) {
      console.error('Error uploading file to S3:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate signed URL for secure file access
   * @param {string} s3Key - S3 object key
   * @param {number} expiresIn - URL expiration time in seconds (default: 3600)
   * @returns {Promise<string>} Signed URL
   */
  async getSignedUrl(s3Key, expiresIn = 3600) {
    try {
      const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key
      });
      
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
      return signedUrl;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      throw error;
    }
  }

  /**
   * Delete file from S3
   * @param {string} s3Key - S3 object key
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(s3Key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key
      });
      
      await s3Client.send(command);
      return true;
    } catch (error) {
      console.error('Error deleting file from S3:', error);
      return false;
    }
  }

  /**
   * Get file metadata from S3
   * @param {string} s3Key - S3 object key
   * @returns {Promise<Object>} File metadata
   */
  async getFileMetadata(s3Key) {
    try {
      const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key
      });
      
      const response = await s3Client.send(command);
      return {
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        lastModified: response.LastModified,
        metadata: response.Metadata
      };
    } catch (error) {
      console.error('Error getting file metadata:', error);
      throw error;
    }
  }

  /**
   * Check if file exists in S3
   * @param {string} s3Key - S3 object key
   * @returns {Promise<boolean>} File exists status
   */
  async fileExists(s3Key) {
    try {
      await this.getFileMetadata(s3Key);
      return true;
    } catch (error) {
      if (error.name === 'NoSuchKey') {
        return false;
      }
      throw error;
    }
  }
}

module.exports = new S3Service();
