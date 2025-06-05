// Updated participantSchema in src/models/Participant.js

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
  restDays: { 
    type: Number, 
    required: false 
  },
  media: {
    type: [mediaSchema],
    default: []
  },
  dailyStreak: { 
    type: Number, 
    default: 0 
  },
  lastPostDate: { 
    type: Date 
  },
  lastLogDate: {  // NEW: Track when user last logged activity
    type: Date
  },
  totalPoints: {
    type: Number,
    default: 0
  },
  weeklyRestDaysUsed: {  // NEW: Track rest days used this week
    type: Number,
    default: 0
  }
});

// Add virtual for id field
participantSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Ensure virtual fields are serialized
participantSchema.set('toJSON', {
  virtuals: true
});

// Export the model
export const participantModel = mongoose.models.Participant || mongoose.model('Participant', participantSchema);