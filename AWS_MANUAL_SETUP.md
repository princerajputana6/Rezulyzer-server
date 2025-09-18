# Manual AWS Setup for S3 Resume Storage

Since AWS CLI needs a system restart, here's how to set up everything manually through the AWS Console.

## Step 1: AWS Console Login
1. Go to [AWS Console](https://console.aws.amazon.com/)
2. Sign in with your AWS account

## Step 2: Create IAM User for S3 Access

### 2.1 Navigate to IAM
1. Search for "IAM" in the AWS Console
2. Click on "IAM" service

### 2.2 Create User
1. Click "Users" in the left sidebar
2. Click "Create user"
3. **User name**: `ai-portal-s3-user`
4. **Access type**: Check "Provide user access to the AWS Management Console" (optional)
5. Click "Next"

### 2.3 Set Permissions
1. Select "Attach policies directly"
2. Search for and select: `AmazonS3FullAccess` (for testing - we'll create custom policy later)
3. Click "Next"
4. Click "Create user"

### 2.4 Create Access Keys
1. Click on the newly created user
2. Go to "Security credentials" tab
3. Scroll down to "Access keys"
4. Click "Create access key"
5. Select "Application running outside AWS"
6. Click "Next"
7. Add description: "AI Portal S3 Access"
8. Click "Create access key"
9. **IMPORTANT**: Copy both Access Key ID and Secret Access Key immediately

## Step 3: Create S3 Bucket

### 3.1 Navigate to S3
1. Search for "S3" in AWS Console
2. Click on "S3" service

### 3.2 Create Bucket
1. Click "Create bucket"
2. **Bucket name**: `ai-portal-resumes-[your-unique-suffix]` (e.g., `ai-portal-resumes-2024`)
3. **Region**: Select your preferred region (e.g., `us-east-1`)
4. **Block Public Access**: Keep default settings for now
5. Click "Create bucket"

## Step 4: Configure Bucket Permissions

### 4.1 Bucket Policy
1. Click on your newly created bucket
2. Go to "Permissions" tab
3. Scroll to "Bucket policy"
4. Click "Edit"
5. Paste the following policy (replace `YOUR-BUCKET-NAME`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowApplicationAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR-ACCOUNT-ID:user/ai-portal-s3-user"
      },
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    }
  ]
}
```

6. Click "Save changes"

### 4.2 CORS Configuration
1. Still in "Permissions" tab
2. Scroll to "Cross-origin resource sharing (CORS)"
3. Click "Edit"
4. Paste the following:

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

5. Click "Save changes"

## Step 5: Update Environment Variables

Add these to your server `.env` file:

```env
# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_from_step_2.4
AWS_SECRET_ACCESS_KEY=your_secret_key_from_step_2.4
S3_BUCKET_NAME=your_bucket_name_from_step_3.2
```

## Step 6: Create Custom IAM Policy (Recommended)

### 6.1 Create Policy
1. Go back to IAM → Policies
2. Click "Create policy"
3. Select "JSON" tab
4. Paste the following (replace `YOUR-BUCKET-NAME`):

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
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME"
    }
  ]
}
```

5. Click "Next"
6. **Policy name**: `AIPortalS3Policy`
7. Click "Create policy"

### 6.2 Attach Custom Policy
1. Go to IAM → Users → `ai-portal-s3-user`
2. Go to "Permissions" tab
3. Click "Remove" next to `AmazonS3FullAccess`
4. Click "Add permissions" → "Attach policies directly"
5. Search for and select `AIPortalS3Policy`
6. Click "Add permissions"

## Step 7: Test Configuration

### 7.1 Restart Your Development Server
```bash
cd server
npm start
```

### 7.2 Test Upload
1. Navigate to `http://localhost:3000/candidates/add`
2. Try uploading a resume file
3. Check your S3 bucket to see if the file appears

## Troubleshooting

### Common Issues:

1. **Access Denied**
   - Check IAM user permissions
   - Verify bucket policy
   - Ensure correct AWS region

2. **CORS Errors**
   - Verify CORS configuration
   - Check allowed origins match your domain

3. **Environment Variables**
   - Ensure no extra spaces in .env file
   - Restart server after updating .env

### Quick Verification Commands (after AWS CLI restart):

```bash
# Verify AWS credentials
aws sts get-caller-identity

# List your buckets
aws s3 ls

# Test file upload
aws s3 cp test.txt s3://your-bucket-name/
```

## Security Notes

- The bucket policy above allows only your IAM user to access files
- For production, consider using signed URLs instead of public access
- Regularly rotate access keys
- Monitor AWS CloudTrail for access logs

---

**Your Credentials Summary:**
- AWS Access Key ID: [Copy from Step 2.4]
- AWS Secret Access Key: [Copy from Step 2.4]
- S3 Bucket Name: [Your bucket name from Step 3.2]
- AWS Region: [Your selected region]

Save these credentials securely and add them to your `.env` file!
