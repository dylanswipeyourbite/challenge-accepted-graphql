import mongoose from 'mongoose';

const dailyLogSchema = new mongoose.Schema({
  challengeId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Challenge', 
    required: true 
  },
  participantId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true 
  },
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['activity', 'rest'], 
    required: true 
  },
  activityType: { 
    type: String, 
    enum: ['running', 'cycling', 'swimming', 'gym','yoga', 'walking', 'hiking', 'other'],
    required: function() { return this.type === 'activity'; }
  },
  notes: { type: String },
  date: { type: Date, required: true },
  points: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Ensure one log per user per day per challenge
dailyLogSchema.index({ 
  challengeId: 1, 
  user: 1, 
  date: 1 
}, { unique: true });

export const dailyLogModel = mongoose.model('DailyLog', dailyLogSchema);