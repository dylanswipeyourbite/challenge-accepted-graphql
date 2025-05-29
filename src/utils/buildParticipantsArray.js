import { userModel } from '../models/User.js';

export const buildParticipantsArray = async (participantFirebaseUids, creatorFirebaseUid) => {
  // 1. Fetch users from DB
  const users = await userModel.find({ firebaseUid: { $in: participantFirebaseUids } });

  // 2. Map firebaseUid → full user
  const userMap = {};
  users.forEach(user => {
    userMap[user.firebaseUid] = user;
  });

  // 3. Ensure no missing users
  if (users.length !== participantFirebaseUids.length) {
    throw new Error('Some Firebase UIDs are not found in the database');
  }

  // 4. Map to participants array
  const participants = participantFirebaseUids.map(firebaseUid => {
    const user = userMap[firebaseUid];

    return {
      userId: user._id,
      firebaseUid,
      role: (firebaseUid === creatorFirebaseUid) ? 'creator' : 'participant',
      status: 'pending',
      progress: 0,
      joinedAt: new Date(),
      media: []
    };
  });

  return participants;
};
