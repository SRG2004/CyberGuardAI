import mongoose from 'mongoose';

const scanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  input: { type: String, required: true },
  inputType: { type: String, enum: ['url', 'email', 'text'], default: 'url' },
  result: { type: mongoose.Schema.Types.ObjectId, ref: 'Threat', default: null },
  source: { type: String, enum: ['extension', 'dashboard', 'api'], default: 'dashboard' },
  durationMs: { type: Number, default: 0 },
}, { timestamps: true });

scanSchema.index({ createdAt: -1 });
scanSchema.index({ userId: 1, createdAt: -1 });
scanSchema.index({ source: 1, createdAt: -1 });

export default mongoose.model('Scan', scanSchema);
