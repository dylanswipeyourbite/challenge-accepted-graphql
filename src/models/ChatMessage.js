import mongoose from 'mongoose';

// File: src/models/ChatMessage.js
const chatMessageSchema = new mongoose.Schema({
    challengeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Challenge', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    type: {
      type: String,
      enum: ['text', 'achievement', 'milestone', 'system'],
      default: 'text'
    },
    metadata: { type: Map, of: String }, // For achievement/milestone messages
    createdAt: { type: Date, default: Date.now },
    editedAt: Date,
    reactions: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      emoji: String,
      createdAt: { type: Date, default: Date.now }
    }]
  });

export const chatMessageModel = mongoose.model('chatMessage', chatMessageSchema);