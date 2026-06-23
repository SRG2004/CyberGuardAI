import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  anonymousId: { type: String, required: true, unique: true },
  type: { type: String, enum: ['phishing_link', 'malicious_email', 'fake_website', 'other'], default: 'other' },
  url: { type: String, default: null },
  description: { type: String, default: null },
  evidenceUrl: { type: String, default: null },
  status: { type: String, enum: ['pending', 'under_review', 'confirmed', 'dismissed'], default: 'pending', index: true },
  aiVerdict: { type: String, default: null },
  aiScore: { type: Number, default: 0 },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewNotes: { type: String, default: null },
}, { timestamps: true });

reportSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('Report', reportSchema);
