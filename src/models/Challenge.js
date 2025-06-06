// Updated challengeSchema in src/models/Challenge.js

import mongoose from 'mongoose';
import { participantSchema } from './Participant.js';

const milestoneSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  type: {
    type: String,
    enum: ['points', 'streak', 'activities', 'custom'],
    required: true
  },
  targetValue: { type: Number, required: true },
  icon: { type: String, default: '🎯' },
  reward: { type: String },
  achievedBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    achievedAt: { type: Date }
  }],
  createdAt: { type: Date, default: Date.now }
});

const challengeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String},
  rules: [{ type: String }], // Changed from String to array of Strings
  sport: { 
    type: String, 
    enum: ['running', 'cycling', 'swimming', 'gym','yoga', 'walking', 'hiking', 'other'], 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['competitive', 'collaborative'], 
    required: true 
  },
  startDate: { type: Date, required: true },
  timeLimit: { type: Date, required: true }, // End date
  wager: { type: String },

  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  participants: [participantSchema],

  createdAt: { type: Date, default: Date.now },
  status: { 
    type: String, 
    enum: ['active', 'pending', 'completed', 'expired'], 
    default: 'pending' 
  },
  challengeStreak: { 
    type: Number, 
    default: 0 
  },
  lastCompleteLogDate: { 
    type: Date 
  },

  // Requirements
  minWeeklyActivities: { type: Number, default: 4 },
  minPointsToJoin: { type: Number, default: 0 },
  allowedActivities: {
    type: [String],
    enum: ['running', 'cycling', 'swimming', 'gym','yoga', 'walking', 'hiking', 'other'],
    default: ['running', 'cycling', 'gym', 'other']
  },
  requireDailyPhoto: { type: Boolean, default: false },
  
  // Notification preferences
  enableReminders: { type: Boolean, default: true },
  reminderTime: { type: String, default: '08:00' },
  
  // Creator's rest days
  creatorRestDays: { type: Number, default: 1 },
  
  // Template reference
  template: { type: String },
  
  // Badges earned in this challenge
  earnedBadges: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    badgeType: String,
    earnedAt: Date
  }],
  
  // Milestones
  milestones: [milestoneSchema],
  
  // Chat
  chatEnabled: { type: Boolean, default: true },
  lastChatActivity: { type: Date }
});

// Virtual for id field
challengeSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Ensure virtual fields are serialized
challengeSchema.set('toJSON', {
  virtuals: true
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

// Method to check daily completion
challengeSchema.methods.checkDailyCompletion = async function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const acceptedParticipants = this.participants.filter(p => p.status === 'accepted');
  
  if (acceptedParticipants.length === 0) return false;
  
  const { dailyLogModel } = await import('./DailyLog.js');
  
  for (const participant of acceptedParticipants) {
    const todayLog = await dailyLogModel.findOne({
      challengeId: this._id,
      user: participant.user,
      date: { $gte: today, $lt: tomorrow }
    });
    
    if (!todayLog) return false;
  }
  
  return true;
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