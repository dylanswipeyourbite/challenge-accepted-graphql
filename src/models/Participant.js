import mongoose from 'mongoose';
import { mediaSchema } from './Media.js';

export const participantSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  firebaseUid: { 
    type: String, 
    required: true 
  },
  role: {
    type: String,
    enum: ['creator', 'admin', 'participant', 'spectator'],
    required: true
  },
  progress: { 
    type: Number, 
    default: 0 
  },
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'rejected', 'completed'], 
    default: 'pending' 
  },
  joinedAt: { 
    type: Date, 
    default: Date.now 
  },
  restDays: { type: Number, required: false },
  media: [mediaSchema],
  dailyStreak: { type: Number, default: 0 },
  lastPostDate: { type: Date } 
},
);

// ✅ Safe export to prevent OverwriteModelError
export const participantModel = mongoose.models.Participant || mongoose.model('Participant', participantSchema);
