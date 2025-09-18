const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { HTTP_STATUS, UPLOAD_LIMITS, ERROR_MESSAGES } = require('../utils/constants');
const { formatResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

// Ensure upload directories exist
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath;
    
    switch (file.fieldname) {
      case 'resume':
        uploadPath = path.join(__dirname, '../../uploads/resumes');
        break;
      case 'avatar':
        uploadPath = path.join(__dirname, '../../uploads/avatars');
        break;
      default:
        uploadPath = path.join(__dirname, '../../uploads/temp');
    }
    
    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, extension);
    cb(null, `${file.fieldname}-${uniqueSuffix}-${baseName}${extension}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'resume') {
    // Allow only PDF and DOC files for resumes
    if (UPLOAD_LIMITS.RESUME.ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, and DOCX files are allowed for resumes'), false);
    }
  } else if (file.fieldname === 'avatar') {
    // Allow only image files for avatars
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for avatars'), false);
    }
  } else {
    cb(null, true);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: UPLOAD_LIMITS.RESUME.MAX_SIZE,
    files: 5,
  },
  fileFilter: fileFilter,
});

// Upload middleware for different file types
const uploadMiddleware = {
  resume: upload.single('resume'),
  avatar: upload.single('avatar'),
  multiple: upload.array('files', 5),
  fields: upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'documents', maxCount: 5 }
  ]),
};

// Error handling middleware for multer
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    let message = ERROR_MESSAGES.INTERNAL_ERROR;
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = ERROR_MESSAGES.FILE_TOO_LARGE;
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files uploaded';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        break;
      default:
        message = error.message;
    }
    
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      formatResponse(false, message)
    );
  } else if (error) {
    logger.error(`Upload error: ${error.message}`);
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      formatResponse(false, error.message || ERROR_MESSAGES.INVALID_FILE_TYPE)
    );
  }
  
  next();
};

// Clean up old files
const cleanupOldFiles = (directory, maxAge = 24 * 60 * 60 * 1000) => {
  const dirPath = path.join(__dirname, '../../uploads', directory);
  
  if (!fs.existsSync(dirPath)) return;
  
  fs.readdir(dirPath, (err, files) => {
    if (err) {
      logger.error(`Error reading directory ${dirPath}: ${err.message}`);
      return;
    }
    
    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      fs.stat(filePath, (err, stats) => {
        if (err) {
          logger.error(`Error getting file stats for ${filePath}: ${err.message}`);
          return;
        }
        
        const now = new Date().getTime();
        const fileTime = new Date(stats.ctime).getTime();
        
        if (now - fileTime > maxAge) {
          fs.unlink(filePath, (err) => {
            if (err) {
              logger.error(`Error deleting file ${filePath}: ${err.message}`);
            } else {
              logger.info(`Cleaned up old file: ${filePath}`);
            }
          });
        }
      });
    });
  });
};

// Schedule cleanup every hour for temp files
setInterval(() => {
  cleanupOldFiles('temp');
}, 60 * 60 * 1000);

module.exports = {
  upload,
  uploadResume: uploadMiddleware.resume,
  uploadAvatar: uploadMiddleware.avatar,
  uploadMultiple: uploadMiddleware.multiple,
  uploadFields: uploadMiddleware.fields,
  handleUploadError,
  cleanupOldFiles,
};
