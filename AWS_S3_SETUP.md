# AWS S3 Setup Guide for Resume Storage

This guide will help you set up AWS S3 for storing resume files in your AI Test Portal.

## Prerequisites

1. AWS Account
2. AWS CLI installed (optional but recommended)
3. Basic understanding of AWS IAM

## Step 1: Create S3 Bucket

1. **Login to AWS Console**
   - Go to [AWS Console](https://console.aws.amazon.com/)
   - Navigate to S3 service

2. **Create Bucket**
   - Click "Create bucket"
   - Choose a unique bucket name (e.g., `your-company-resumes-bucket`)
   - Select your preferred region (e.g., `us-east-1`)
   - Keep default settings for now
   - Click "Create bucket"

## Step 2: Configure Bucket Policy

1. **Go to your bucket** → **Permissions** → **Bucket Policy**

2. **Add the following policy** (replace `your-bucket-name` with your actual bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

**⚠️ Security Note:** This policy allows public read access. For production, consider using signed URLs instead.

## Step 3: Configure CORS

1. **Go to your bucket** → **Permissions** → **Cross-origin resource sharing (CORS)**

2. **Add the following CORS configuration**:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://yourdomain.com"
    ],
    "ExposeHeaders": ["ETag"]
  }
]
```

## Step 4: Create IAM User

1. **Navigate to IAM** → **Users** → **Create user**

2. **User Details**
   - Username: `ai-portal-s3-user`
   - Access type: Programmatic access

3. **Attach Policies**
   - Create a custom policy or use `AmazonS3FullAccess` (not recommended for production)

### Custom IAM Policy (Recommended)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:GetObjectVersion"
      ],
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::your-bucket-name"
    }
  ]
}
```

4. **Save Access Keys**
   - Copy the Access Key ID and Secret Access Key
   - Store them securely

## Step 5: Update Environment Variables

Add the following to your `.env` file:

```env
# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
S3_BUCKET_NAME=your-bucket-name
```

## Step 6: Test the Configuration

1. **Start your server**
   ```bash
   cd server
   npm start
   ```

2. **Test file upload**
   - Navigate to `/candidates/add`
   - Upload a resume file
   - Check if it appears in your S3 bucket

## Security Best Practices

### For Production:

1. **Use IAM Roles** instead of IAM users when possible
2. **Implement bucket versioning** for file recovery
3. **Enable server-side encryption**
4. **Use signed URLs** instead of public bucket policy
5. **Implement proper access logging**
6. **Set up lifecycle policies** to manage storage costs

### Enhanced Security Configuration:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyInsecureConnections",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::your-bucket-name",
        "arn:aws:s3:::your-bucket-name/*"
      ],
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    }
  ]
}
```

## Troubleshooting

### Common Issues:

1. **Access Denied Error**
   - Check IAM permissions
   - Verify bucket policy
   - Ensure correct region

2. **CORS Error**
   - Verify CORS configuration
   - Check allowed origins

3. **File Upload Fails**
   - Check file size limits
   - Verify AWS credentials
   - Check network connectivity

### Debug Commands:

```bash
# Test AWS credentials
aws sts get-caller-identity

# List S3 buckets
aws s3 ls

# Test file upload
aws s3 cp test-file.pdf s3://your-bucket-name/test/
```

## Cost Optimization

1. **Use S3 Intelligent Tiering** for automatic cost optimization
2. **Set up lifecycle policies** to move old files to cheaper storage classes
3. **Monitor usage** with AWS Cost Explorer
4. **Delete incomplete multipart uploads**

## Monitoring and Logging

1. **Enable CloudTrail** for API logging
2. **Set up CloudWatch metrics** for monitoring
3. **Configure S3 access logging**
4. **Set up alerts** for unusual activity

## Backup and Recovery

1. **Enable versioning** on your S3 bucket
2. **Set up cross-region replication** for disaster recovery
3. **Regular backup verification**
4. **Document recovery procedures**

---

## Quick Setup Checklist

- [ ] Create S3 bucket
- [ ] Configure bucket policy
- [ ] Set up CORS
- [ ] Create IAM user with appropriate permissions
- [ ] Update .env file with AWS credentials
- [ ] Test file upload functionality
- [ ] Verify files are stored in S3
- [ ] Test file download functionality
- [ ] Set up monitoring (optional)
- [ ] Implement security best practices

---

**Need Help?**
- AWS Documentation: https://docs.aws.amazon.com/s3/
- AWS Support: https://console.aws.amazon.com/support/
