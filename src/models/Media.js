import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  text: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

export const mediaSchema = new mongoose.Schema({
  challengeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Challenge', required: true },
  participantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Participant' }, // optional
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  url: { type: String, required: true },
  type: { type: String, enum: ['photo', 'video'], required: true },
  uploadedAt: { type: Date, default: Date.now },
  caption: { type: String },

  cheers: { type: [String], default: [] }, 
  comments: { type: [commentSchema], default: [] }  
});

export const mediaModel = mongoose.model('Media', mediaSchema);