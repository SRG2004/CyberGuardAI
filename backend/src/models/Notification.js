import mongoose from 'mongoose';

const notifSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['new_threat', 'report_update', 'system_alert', 'model_update'], default: 'new_threat' },
  title: { type: String, required: true },
  body: { type: String, default: '' },
  isRead: { type: Boolean, default: false },
  link: { type: String, default: '' },
}, { timestamps: true });

notifSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export default mongoose.model('Notification', notifSchema);
