import { challengeModel } from '../models/Challenge.js';

// Helper function to activate challenges when their start date arrives
export const activatePendingChallenges = async () => {
    const pendingChallenges = await challengeModel.find({
      status: 'pending',
      startDate: { $lte: new Date() }
    });
  
    let activatedCount = 0;
    for (const challenge of pendingChallenges) {
      const allAccepted = challenge.participants.every(p => p.status === 'accepted');
      if (allAccepted) {
        challenge.status = 'active';
        await challenge.save();
        activatedCount++;
        
        // Publish update
        pubsub.publish(CHALLENGE_UPDATED, { challengeUpdated: challenge });
      }
    }
    
    return activatedCount;
  };
  