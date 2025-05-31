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
  status: { type: String, enum: ['active', 'pending', 'completed', 'expired'], default: 'pending' },
  challengeStreak: { 
    type: Number, 
    default: 0 
  },
  lastCompleteLogDate: { 
    type: Date 
  },
});

// Add method to update challenge streak
challengeSchema.methods.updateChallengeStreak = async function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const allLogged = await this.checkDailyCompletion();
  
  if (allLogged) {
    // Check if this is consecutive
    if (this.lastCompleteLogDate) {
      const lastLog = new Date(this.lastCompleteLogDate);
      lastLog.setHours(0, 0, 0, 0);
      
      const dayDiff = Math.floor((today - lastLog) / (1000 * 60 * 60 * 24));
      
      if (dayDiff === 1) {
        // Consecutive day
        this.challengeStreak += 1;
      } else if (dayDiff > 1) {
        // Streak broken
        this.challengeStreak = 1;
      }
      // If dayDiff === 0, already counted today
    } else {
      // First complete day
      this.challengeStreak = 1;
    }
    
    this.lastCompleteLogDate = today;
    await this.save();
  }
};

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