import mongoose from 'mongoose';

const threatSchema = new mongoose.Schema({
  url: { type: String, default: null, index: true },
  emailSubject: { type: String, default: null },
  rawContent: { type: String, default: null },
  type: {
    type: String,
    enum: ['phishing', 'malware', 'suspicious', 'safe', 'spam', 'fake_domain'],
    default: 'suspicious',
    index: true,
  },
  riskScore: { type: Number, min: 0, max: 100, default: 0 },
  sources: {
    mlModel: {
      probability: { type: Number, default: 0 },
      topFeatures: [{ type: String }],
    },
    whois: {
      domainAge: { type: Number, default: null },
      registrar: { type: String, default: null },
      country: { type: String, default: null },
    },
  },
  detectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  extensionSessionId: { type: String, default: null, index: true },
  verdict: {
    type: String,
    enum: ['malicious', 'suspicious', 'safe'],
    default: 'suspicious',
    index: true,
  },
  isVerified: { type: Boolean, default: false },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

threatSchema.index({ createdAt: -1 });
threatSchema.index({ type: 1, createdAt: -1 });
threatSchema.index({ riskScore: -1 });
threatSchema.index({ verdict: 1, createdAt: -1 });

export default mongoose.model('Threat', threatSchema);
