// Updated challengeSchema in src/models/Challenge.js

import mongoose from 'mongoose';
import { participantSchema } from './Participant.js';

const challengeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  sport: { type: String, enum: ['running', 'cycling', 'workout'], required: true },
  type: { type: String, enum: ['competitive', 'collaborative'], required: true },
  startDate: { type: Date, required: true }, // NEW: Start date field
  timeLimit: { type: Date, required: true }, // End date
  wager: { type: String },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  participants: [participantSchema],

  createdAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['active', 'pending', 'completed', 'expired'], default: 'pending' }
});

// Add a method to check if challenge should be active based on start date
challengeSchema.methods.checkAndUpdateStatus = function() {
  const now = new Date();
  
  // If all participants have accepted AND start date has passed
  const allAccepted = this.participants.every(p => p.status === 'accepted');
  
  if (allAccepted && now >= this.startDate && this.status === 'pending') {
    this.status = 'active';
    return true;
  }
  
  // Check if challenge has expired
  if (now > this.timeLimit && this.status !== 'completed') {
    this.status = 'expired';
    return true;
  }
  
  return false;
};

export const challengeModel = mongoose.model('challenge', challengeSchema);