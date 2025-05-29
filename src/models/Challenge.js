import mongoose from 'mongoose';
import { participantSchema } from './Participant.js';

const challengeSchema = new mongoose.Schema({
  title: { type: String, required: true }, // e.g., "5km Sprint"
  sport: { type: String, enum: ['running', 'cycling', 'workout'], required: true },
  type: { type: String, enum: ['competitive', 'collaborative'], required: true },
  timeLimit: { type: Date, required: true }, // timestamp for deadline
  wager: { type: String }, // optional fun wager (e.g. "Loser buys coffee")

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  participants: [participantSchema],

  createdAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['active', 'pending', 'completed', 'expired'], default: 'pending' }
});

// export all
export const challengeModel = mongoose.model('challenge', challengeSchema);

