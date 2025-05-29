import { userModel } from '../models/User.js';

export async function buildParticipantsArray(participantIds, creatorId) {
  const participants = [];
  
  // Get creator's firebaseUid
  const creator = await userModel.findById(creatorId);
  if (!creator) throw new Error('Creator not found');
  
  // Add creator as first participant
  participants.push({
    user: creatorId,
    firebaseUid: creator.firebaseUid,
    role: 'creator',
    status: 'accepted',
    joinedAt: new Date(),
    progress: 0,
    restDays: 1, // Default rest days for creator
    dailyStreak: 0,
    totalPoints: 0
    // IMPORTANT: Do NOT include media field at all
  });

  // Add invited participants
  for (const uid of participantIds) {
    const user = await userModel.findOne({ firebaseUid: uid });
    if (user) {
      participants.push({
        user: user._id,
        firebaseUid: uid,
        role: 'participant',
        status: 'pending',
        progress: 0,
        dailyStreak: 0,
        totalPoints: 0
        // IMPORTANT: Do NOT include media field at all
      });
    }
  }

  return participants;
}