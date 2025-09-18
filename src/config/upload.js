const multer = require('multer');
const path = require('path');
const fs = require('fs');

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
    
    if (file.fieldname === 'resume') {
      uploadPath = path.join(__dirname, '../../uploads/resumes');
    } else {
      uploadPath = path.join(__dirname, '../../uploads/temp');
    }
    
    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'resume') {
    // Allow only PDF and DOC files for resumes
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOC/DOCX files are allowed for resumes'), false);
    }
  } else {
    cb(null, true);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
  },
  fileFilter: fileFilter,
});

// Middleware for different upload types
const uploadMiddleware = {
  resume: upload.single('resume'),
  multiple: upload.array('files', 5),
  fields: upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'documents', maxCount: 5 }
  ]),
};

// Clean up old files
const cleanupOldFiles = (directory, maxAge = 24 * 60 * 60 * 1000) => {
  const dirPath = path.join(__dirname, '../../uploads', directory);
  
  if (!fs.existsSync(dirPath)) return;
  
  fs.readdir(dirPath, (err, files) => {
    if (err) return;
    
    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        
        const now = new Date().getTime();
        const fileTime = new Date(stats.ctime).getTime();
        
        if (now - fileTime > maxAge) {
          fs.unlink(filePath, (err) => {
            if (err) console.error(`Error deleting file ${filePath}:`, err);
          });
        }
      });
    });
  });
};

// Schedule cleanup every hour
setInterval(() => {
  cleanupOldFiles('temp');
}, 60 * 60 * 1000);

module.exports = {
  upload,
  uploadMiddleware,
  cleanupOldFiles,
};
