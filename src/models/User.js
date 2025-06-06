// src/models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    required: true,
    unique: true
  },
  displayName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  avatarUrl: String,
  
  // Notification settings
  notificationSettings: {
    enableDailyReminders: {
      type: Boolean,
      default: true
    },
    reminderTime: {
      type: String,
      default: '08:00'
    },
    enableSocialNotifications: {
      type: Boolean,
      default: true
    },
    enableAchievementNotifications: {
      type: Boolean,
      default: true
    }
  },
  
  // FCM token for push notifications
  fcmToken: String,
  
  // Badges earned by the user
  badges: [{
    badge: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Badge',
      required: true
    },
    earnedAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Challenge'
    }
  }],
  
  // Stats for quick access
  stats: {
    totalActivities: {
      type: Number,
      default: 0
    },
    totalCheers: {
      type: Number,
      default: 0
    },
    earlyMorningLogs: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ firebaseUid: 1 });
userSchema.index({ email: 1 });
userSchema.index({ 'badges.badge': 1 });

// Virtual for badge count
userSchema.virtual('badgeCount').get(function() {
  return this.badges?.length || 0;
});

// Method to check if user has a specific badge
userSchema.methods.hasBadge = function(badgeType) {
  return this.badges?.some(b => b.badge?.type === badgeType) || false;
};

// Method to award a badge
userSchema.methods.awardBadge = async function(badgeId, challengeId = null) {
  if (!this.badges) {
    this.badges = [];
  }
  
  // Check if already has this badge
  const alreadyHas = this.badges.some(b => b.badge.toString() === badgeId.toString());
  if (alreadyHas) {
    throw new Error('User already has this badge');
  }
  
  this.badges.push({
    badge: badgeId,
    earnedAt: new Date(),
    challengeId
  });
  
  return this.save();
};

// Method to update FCM token
userSchema.methods.updateFCMToken = async function(token) {
  this.fcmToken = token;
  return this.save();
};

// Method to update notification settings
userSchema.methods.updateNotificationSettings = async function(settings) {
  Object.assign(this.notificationSettings, settings);
  return this.save();
};

export const userModel = mongoose.model('User', userSchema);