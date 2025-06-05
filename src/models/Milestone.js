// File: graphql_challengeaccepted/src/models/Milestone.js

import mongoose from 'mongoose';

const milestoneSchema = new mongoose.Schema({
  challengeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Challenge',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['points', 'streak', 'activities', 'custom'],
    required: true,
  },
  target: {
    type: Number,
    required: true,
  },
  description: String,
  currentProgress: {
    type: Number,
    default: 0,
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
  completedAt: Date,
  achievedBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    achievedAt: Date,
    value: Number,
  }],
}, {
  timestamps: true,
});

const Milestone = mongoose.model('Milestone', milestoneSchema);

export default Milestone;