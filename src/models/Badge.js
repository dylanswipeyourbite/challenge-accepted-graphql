// src/models/Badge.js
import mongoose from 'mongoose';

const badgeSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['streak', 'points', 'social', 'milestone', 'special']
  },
  criteria: {
    type: {
      type: String,
      required: true
    },
    value: {
      type: Number,
      required: true
    }
  }
}, {
  timestamps: true
});

// Indexes
badgeSchema.index({ type: 1 });
badgeSchema.index({ category: 1 });

export const badgeModel = mongoose.model('Badge', badgeSchema);