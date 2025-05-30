// Updated src/utils/buildParticipantsArray.js

import { userModel } from '../models/User.js';

export async function buildParticipantsArray(participantIds, creatorId) {
  const participants = [];
  
  // Get creator
  const creator = await userModel.findById(creatorId);
  if (!creator) throw new Error('Creator not found');
  
  // Add creator as first participant - already accepted
  participants.push({
    user: creatorId,
    firebaseUid: creator.firebaseUid,
    role: 'creator',
    status: 'accepted',  // Creator is automatically accepted
    joinedAt: new Date(),
    progress: 0,
    restDays: 1, // Default rest days for creator
    dailyStreak: 0,
    totalPoints: 0
  });

  // Add invited participants with pending status
  for (const uid of participantIds) {
    const user = await userModel.findOne({ firebaseUid: uid });
    if (user && user._id.toString() !== creatorId.toString()) { // Don't add creator twice
      participants.push({
        user: user._id,
        firebaseUid: uid,
        role: 'participant',
        status: 'pending',  // Invited participants start as pending
        progress: 0,
        dailyStreak: 0,
        totalPoints: 0
      });
    }
  }

  return participants;
}