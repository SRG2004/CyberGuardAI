import mongoose from 'mongoose';

const extSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  userAgent: { type: String, default: '' },
  version: { type: String, default: '' },
  lastPingAt: { type: Date, default: Date.now },
  urlsScanned: { type: Number, default: 0 },
  threatsDetected: { type: Number, default: 0 },
}, { timestamps: true });

extSchema.index({ lastPingAt: 1 });

export default mongoose.model('ExtensionSession', extSchema);
