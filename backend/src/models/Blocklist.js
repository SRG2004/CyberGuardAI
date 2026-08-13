import mongoose from 'mongoose';

const blocklistSchema = new mongoose.Schema({
  domain: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reason: { type: String, default: '' },
  threatType: { type: String, default: '' },
  source: { type: String, enum: ['admin', 'auto', 'import'], default: 'auto' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

blocklistSchema.index({ domain: 1, isActive: 1 });

export default mongoose.model('Blocklist', blocklistSchema);
