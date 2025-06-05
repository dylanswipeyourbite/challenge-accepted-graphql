import mongoose from 'mongoose';

// File: src/models/Badge.js
const badgeSchema = new mongoose.Schema({
    type: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String, required: true },
    category: {
      type: String,
      enum: ['streak', 'points', 'social', 'milestone', 'special'],
      required: true
    },
    criteria: {
      type: { type: String },
      value: { type: Number }
    }
  });

export const badgeModel = mongoose.model('badge', badgeSchema);