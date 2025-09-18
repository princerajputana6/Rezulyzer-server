# AI Testing Portal - Backend

Node.js/Express backend API for the AI Testing Portal application.

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or cloud)
- AWS Account (for S3 storage)
- AI API Key (OpenAI or Anthropic)

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file with your configuration:
   ```env
   NODE_ENV=development
   PORT=8000
   MONGODB_URI=mongodb://localhost:27017/ai-testing-portal
   JWT_SECRET=your-super-secret-jwt-key
   JWT_EXPIRE=30d
   
   # AWS Configuration
   AWS_ACCESS_KEY_ID=your-aws-access-key
   AWS_SECRET_ACCESS_KEY=your-aws-secret-key
   AWS_REGION=us-east-1
   AWS_S3_BUCKET=your-s3-bucket-name
   
   # AI Configuration
   OPENAI_API_KEY=your-openai-api-key
   # OR
   ANTHROPIC_API_KEY=your-anthropic-api-key
   
   # Email Configuration (optional)
   EMAIL_FROM=noreply@yourapp.com
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ```

3. **Start the server:**
   ```bash
   # Development mode (with nodemon)
   npm run dev
   
   # Production mode
   npm start
   ```
   
   Server will run on http://localhost:8000

4. **Seed the database (optional):**
   ```bash
   # Seed basic data
   npm run seed
   
   # Seed interview data
   npm run seed:interviews
   ```

## 📁 Project Structure

```
server/
├── src/                   # Source code
│   ├── config/           # Configuration files
│   │   ├── database.js   # MongoDB connection
│   │   ├── email.js      # Email configuration
│   │   ├── jwt.js        # JWT configuration
│   │   └── upload.js     # File upload config
│   ├── controllers/      # Route controllers
│   │   ├── authController.js
│   │   ├── interviewController.js
│   │   ├── analyticsController.js
│   │   └── ...
│   ├── middleware/       # Custom middleware
│   │   ├── auth.js       # Authentication middleware
│   │   ├── errorHandler.js
│   │   └── ...
│   ├── models/          # Mongoose models
│   │   ├── User.js
│   │   ├── Interview.js
│   │   ├── Candidate.js
│   │   └── ...
│   ├── routes/          # API routes
│   │   ├── auth.js
│   │   ├── interviewRoutes.js
│   │   ├── analyticsRoutes.js
│   │   └── ...
│   ├── services/        # Business logic services
│   │   ├── aiService.js
│   │   ├── emailService.js
│   │   └── resumeParserService.js
│   └── utils/           # Utility functions
│       ├── cache.js     # In-memory caching
│       ├── logger.js    # Logging utility
│       └── ...
├── scripts/             # Database scripts
│   ├── seed-db.js       # Database seeder
│   └── seed-interviews.js
├── __tests__/           # Test files
├── docs/               # API documentation
├── uploads/            # File uploads (gitignored)
├── logs/              # Log files (gitignored)
├── .env.example       # Environment template
├── server.js          # Entry point
└── package.json       # Dependencies
```

## 🛠️ Available Scripts

- **`npm start`** - Start production server
- **`npm run dev`** - Start development server with nodemon
- **`npm test`** - Run tests with Jest
- **`npm run test:watch`** - Run tests in watch mode
- **`npm run seed`** - Seed database with sample data
- **`npm run seed:interviews`** - Seed interview data

## 🎯 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/me` - Get current user

### Interviews
- `GET /api/interviews` - List interviews (with filters)
- `POST /api/interviews` - Create interview
- `GET /api/interviews/:id` - Get interview details
- `PUT /api/interviews/:id` - Update interview
- `DELETE /api/interviews/:id` - Delete interview
- `GET /api/interviews/upcoming` - Get upcoming interviews
- `PUT /api/interviews/:id/reschedule` - Reschedule interview
- `PUT /api/interviews/:id/cancel` - Cancel interview
- `PUT /api/interviews/:id/complete` - Complete interview

### Analytics
- `GET /api/analytics/kpi/admin` - Admin KPIs (cached 60s)
- `GET /api/analytics/kpi/company` - Company KPIs (cached 60s)
- `GET /api/analytics/dashboard` - Dashboard analytics

### Tests
- `GET /api/tests` - List tests
- `POST /api/tests` - Create test
- `GET /api/tests/:id` - Get test details
- `PUT /api/tests/:id` - Update test
- `DELETE /api/tests/:id` - Delete test

### Candidates
- `GET /api/candidates` - List candidates
- `POST /api/candidates` - Create candidate
- `GET /api/candidates/:id` - Get candidate details
- `PUT /api/candidates/:id` - Update candidate
- `POST /api/candidates/upload-resume` - Upload resume

Full API documentation: `docs/API.md`

## 🔧 Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **JWT** - Authentication
- **AWS S3** - File storage
- **OpenAI/Anthropic** - AI integration
- **Jest** - Testing framework
- **Winston** - Logging
- **Nodemailer** - Email sending

## 🔐 Security Features

- **JWT Authentication** - Secure token-based auth
- **Password Hashing** - bcrypt for password security
- **Rate Limiting** - Prevent abuse
- **CORS Protection** - Cross-origin request security
- **Helmet** - Security headers
- **Input Sanitization** - Prevent injection attacks
- **File Upload Validation** - Secure file handling

## 📊 Monitoring & Logging

- **Winston Logger** - Structured logging
- **Request Logging** - All API requests logged
- **Error Tracking** - Comprehensive error handling
- **Health Check** - `GET /api/health`

## 🗄️ Database

### MongoDB Collections
- **users** - User accounts and profiles
- **interviews** - Interview scheduling and management
- **candidates** - Candidate information and resumes
- **tests** - Test definitions and questions
- **testresults** - Test attempt results
- **companies** - Company information
- **questions** - Question bank

### Indexes
Optimized indexes for:
- User authentication queries
- Interview date/company filtering
- Candidate search operations
- Test result analytics

## 🐳 Docker Support

### Development
```bash
# Build and run with docker-compose
docker-compose up -d
```

### Production
```bash
# Build image
docker build -t ai-portal-server .

# Run container
docker run -p 8000:8000 --env-file .env ai-portal-server
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- interviews.controller.test.js
```

### Test Coverage
- Unit tests for controllers
- Integration tests for API endpoints
- Mock database and external services

## 🚨 Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   ```bash
   # Check MongoDB is running
   mongosh
   
   # Verify connection string in .env
   MONGODB_URI=mongodb://localhost:27017/ai-testing-portal
   ```

2. **AWS S3 Errors**
   ```bash
   # Verify AWS credentials
   aws configure list
   
   # Check bucket permissions
   # Ensure bucket exists and has proper CORS policy
   ```

3. **AI API Errors**
   ```bash
   # Check API key is valid
   # Verify rate limits not exceeded
   # Check network connectivity
   ```

4. **Port Already in Use**
   ```bash
   # Find process using port 8000
   netstat -ano | findstr :8000
   
   # Kill process or change PORT in .env
   ```

### Debug Mode

Enable debug logging:
```env
NODE_ENV=development
DEBUG=true
```

## 📈 Performance

### Caching
- **In-memory cache** for KPI endpoints (60s TTL)
- **MongoDB indexes** for fast queries
- **Connection pooling** for database efficiency

### Optimization
- **Compression** middleware for responses
- **Rate limiting** to prevent abuse
- **Pagination** for large datasets
- **Selective field population** in queries

## 🔄 Deployment

### Environment Setup
1. Set `NODE_ENV=production`
2. Use strong `JWT_SECRET`
3. Configure production MongoDB URI
4. Set up AWS S3 bucket with proper CORS
5. Configure email service (optional)

### Process Management
```bash
# Using PM2
npm install -g pm2
pm2 start server.js --name "ai-portal-api"
pm2 startup
pm2 save
```

## 📝 Contributing

1. Create a feature branch
2. Write tests for new features
3. Ensure all tests pass
4. Update API documentation
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.
