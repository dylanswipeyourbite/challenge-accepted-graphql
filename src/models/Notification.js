import mongoose from 'mongoose';

// File: src/models/Notification.js
const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['reminder', 'achievement', 'social', 'milestone', 'streak_warning'],
      required: true
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: { type: Map, of: String },
    read: { type: Boolean, default: false },
    scheduledFor: Date,
    sentAt: Date,
    createdAt: { type: Date, default: Date.now }
  });

export const notificationModel = mongoose.model('Notification', notificationSchema);