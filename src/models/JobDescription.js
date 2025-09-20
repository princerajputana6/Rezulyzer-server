const mongoose = require('mongoose');

const JDRequiredSkillSchema = new mongoose.Schema({
  skillName: { type: String, required: true, trim: true },
  importanceLevel: { type: Number, min: 1, max: 5, default: 3 },
  requiredProficiency: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'intermediate' }
}, { _id: false });

const JobDescriptionSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  requiredSkills: { type: [JDRequiredSkillSchema], default: [] },
  minExperience: { type: Number, min: 0, default: 0 },
  maxExperience: { type: Number, min: 0, default: 50 },
  status: { type: String, enum: ['draft', 'active', 'archived'], default: 'active' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('JobDescription', JobDescriptionSchema);
