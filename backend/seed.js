import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const users = [
  { email: 'admin@cyberguard.com', password: 'Admin@123', displayName: 'Admin User', role: 'admin' },
  { email: 'student@cyberguard.com', password: 'Student@123', displayName: 'Student User', role: 'student' },
];

async function seed() {
  const uri = 'mongodb+srv://sarthakgosavi77_db_user:TV9LhobsPbkvSXEJ@cluster0.03kgp84.mongodb.net/cyberguard';
  console.log(`Connecting to ${uri}...`);
  await mongoose.connect(uri);

  const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['student', 'admin'], default: 'student' },
    displayName: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    lastActive: { type: Date, default: new Date() },
  }, { timestamps: true });

  const User = mongoose.model('User', UserSchema);

  for (const u of users) {
    const existing = await User.findOne({ email: u.email });
    if (existing) {
      console.log(`Skipping ${u.email} — already exists`);
      continue;
    }
    const hash = await bcrypt.hash(u.password, 12);
    await User.create({ email: u.email, passwordHash: hash, displayName: u.displayName, role: u.role, isActive: true });
    console.log(`Created ${u.role}: ${u.email} / ${u.password}`);
  }

  const count = await User.countDocuments();
  console.log(`\nTotal users: ${count}`);
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
