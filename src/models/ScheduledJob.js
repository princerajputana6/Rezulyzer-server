const mongoose = require('mongoose');

const ScheduledJobSchema = new mongoose.Schema({
  type: { type: String, required: true, enum: ['invite_test'] },
  payload: { type: Object, required: true },
  scheduledAt: { type: Date, required: true, index: true },
  status: { type: String, enum: ['pending', 'processing', 'done', 'failed'], default: 'pending', index: true },
  lastError: { type: String },
  attempts: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', index: true }
}, { timestamps: true });

module.exports = mongoose.model('ScheduledJob', ScheduledJobSchema);
