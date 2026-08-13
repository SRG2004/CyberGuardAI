import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const users = [
  { email: 'admin@example.com', password: 'admin123', displayName: 'Admin User', role: 'admin' },
  { email: 'student@example.com', password: 'student123', displayName: 'Student User', role: 'student' },
];

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cyberguard';
  console.log(`Connecting to ${uri}...`);
  await mongoose.connect(uri);

  const collections = await mongoose.connection.db.collections();
  for (let collection of collections) {
    if (!collection.collectionName.startsWith('system.')) {
      await collection.drop();
      console.log(`Dropped collection: ${collection.collectionName}`);
    }
  }

  const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['student', 'admin'], default: 'student' },
    displayName: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    lastActive: { type: Date, default: new Date() },
  }, { timestamps: true });

  // Prevent Mongoose from compiling the model multiple times if seed is run in watch mode
  const User = mongoose.models.User || mongoose.model('User', UserSchema);

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 12);
    await User.create({ email: u.email, passwordHash: hash, displayName: u.displayName, role: u.role, isActive: true });
    console.log(`Created ${u.role}: ${u.email} / ${u.password}`);
  }

  const count = await User.countDocuments();
  console.log(`\nDatabase completely cleared.`);
  console.log(`Total seeded users: ${count}`);
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
