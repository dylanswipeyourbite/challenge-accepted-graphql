import { PubSub } from 'graphql-subscriptions';
import { GraphQLScalarType, Kind, GraphQLError } from 'graphql';
import { buildParticipantsArray } from './utils/buildParticipantsArray.js';
import { getUserActivitySummary } from './utils/getUserActivitySummary.js';
import { activatePendingChallenges } from './utils/activatePendingChallenges.js';
import { userModel } from './models/User.js'; 
import { mediaModel } from './models/Media.js';
import { dailyLogModel } from './models/DailyLog.js';
import { challengeModel } from './models/Challenge.js';
import { chatMessageModel } from './models/ChatMessage.js';
import { badgeModel } from './models/Badge.js';
import { notificationModel } from './models/Notification.js';
import { milestoneService } from './services/milestoneService.js';
import { analyticsService } from './services/analyticsService.js';
import { notificationService } from './services/notificationService.js';

const pubsub = new PubSub();

export const getPubSub = () => pubsub;

// SUBSCRIPTION FOR REAL-TIME UPDATES
const MEDIA_ADDED = 'MEDIA_ADDED';
const CHALLENGE_UPDATED = 'CHALLENGE_UPDATED';

const dateScalar = new GraphQLScalarType({
  name: 'Date',
  description: 'Date custom scalar type',
  parseValue(value) {
    return new Date(value); // client -> server
  },
  serialize(value) {
    return value.toISOString(); // server -> client
  },
  parseLiteral(ast) {
    return ast.kind === Kind.STRING ? new Date(ast.value) : null;
  }
});

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day; // Adjust to get Monday as start of week
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

// Add this to the resolvers.js file

// Helper function to add isCurrentUser and id to participants
const addIsCurrentUserToParticipants = (challenge, userId) => {
  const challengeObj = challenge.toObject ? challenge.toObject() : challenge;
  
  // Ensure the id field is present for challenge
  if (!challengeObj.id && challengeObj._id) {
    challengeObj.id = challengeObj._id.toString();
  }
  
  // Handle createdBy field
  if (challengeObj.createdBy) {
    if (challengeObj.createdBy._id && !challengeObj.createdBy.id) {
      challengeObj.createdBy.id = challengeObj.createdBy._id.toString();
    }
  }
  
  // Handle participants
  if (challengeObj.participants && userId) {
    challengeObj.participants = challengeObj.participants.map(p => {
      const participantObj = p.toObject ? p.toObject() : p;
      
      // Ensure participant has id field
      if (!participantObj.id && participantObj._id) {
        participantObj.id = participantObj._id.toString();
      }
      
      // Ensure user has id field if it exists
      if (participantObj.user) {
        if (participantObj.user._id && !participantObj.user.id) {
          participantObj.user.id = participantObj.user._id.toString();
        }
      }
      
      return {
        ...participantObj,
        id: participantObj.id || participantObj._id?.toString() || '',
        isCurrentUser: participantObj.user && participantObj.user._id ? 
          participantObj.user._id.toString() === userId.toString() : false
      };
    });
  }
  
  return challengeObj;
};

// Helper function to update challenge streak manually
async function updateChallengeStreakManually(challengeId) {
  const challenge = await challengeModel.findById(challengeId);
  if (!challenge) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get all accepted participants
  const acceptedParticipants = challenge.participants.filter(p => p.status === 'accepted');
  
  if (acceptedParticipants.length === 0) return; // No accepted participants
  
  // Check if all participants have logged today
  let allLogged = true;
  for (const participant of acceptedParticipants) {
    const todayLog = await dailyLogModel.findOne({
      challengeId: challenge._id,
      user: participant.user,
      date: { $gte: today, $lt: tomorrow }
    });
    
    if (!todayLog) {
      allLogged = false;
      break;
    }
  }

  if (allLogged) {
    // Check if we already counted today
    if (challenge.lastCompleteLogDate) {
      const lastLog = new Date(challenge.lastCompleteLogDate);
      lastLog.setHours(0, 0, 0, 0);
      
      const dayDiff = Math.floor((today.getTime() - lastLog.getTime()) / (1000 * 60 * 60 * 24));
      
      if (dayDiff === 0) {
        // Already counted today, don't increment
        return;
      } else if (dayDiff === 1) {
        // Consecutive day
        challenge.challengeStreak = (challenge.challengeStreak || 0) + 1;
      } else {
        // Streak broken, reset to 1
        challenge.challengeStreak = 1;
      }
    } else {
      // First complete day
      challenge.challengeStreak = 1;
    }
    
    challenge.lastCompleteLogDate = today;
    await challenge.save();
    
    console.log(`Challenge ${challengeId} streak updated to: ${challenge.challengeStreak}`);
  }
}
export const resolvers = {
  Date: dateScalar,

  Query: {
    userStats: async (_, __, { userId }) => {
      if (!userId) throw new GraphQLError('Not authenticated');

      const summary = await getUserActivitySummary(userId);
      
      // Get active challenge info
      const activeChallenge = await challengeModel.findOne({
        'participants.user': userId,
        status: 'active'
      }).populate('participants.user');

      const participant = activeChallenge?.participants.find(
        p => p.user._id.toString() === userId.toString()
      );

      // Check if logged today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const hasLoggedToday = await dailyLogModel.findOne({
        challengeId: activeChallenge?._id,
        user: userId,
        date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
      });

      let activeChallengeInfo = null;
      if (activeChallenge && participant) {
        activeChallengeInfo = {
          id: activeChallenge._id.toString(),
          title: activeChallenge.title,
          allowedRestDays: participant.restDays || 1,
          usedRestDaysThisWeek: summary.weeklyRestDays,
          hasLoggedToday: !!hasLoggedToday
        };
      }

      const completedChallenges = await challengeModel.countDocuments({
        'participants.user': userId,
        status: 'completed'
      });

      return {
        currentStreak: summary.currentStreak,
        totalPoints: summary.totalPoints,
        completedChallenges,
        activeChallenge: activeChallengeInfo
      };
    },

    mediaByChallenge: async (_, { challengeId }, { userId }) => {
      const mediaDocs = await mediaModel.find({ challengeId })
        .populate('user', 'displayName avatarUrl')
        .populate('comments.author', 'displayName avatarUrl');
    
      return mediaDocs.map(doc => {
        const media = doc.toObject({ virtuals: true });
    
        return {
          ...media,
          id: doc._id.toString(),
          cheers: (media.cheers || []).map(uid => uid.toString()),
          hasCheered: userId
            ? media.cheers?.some(uid => uid.toString() === userId.toString())
            : false,
          comments: (media.comments || []).map(comment => ({
            ...comment,
            id: comment._id?.toString(),
            author: comment.author
          }))
        };
      });
    },    

    pendingChallenges: async (_, __, { userId }) => {
      if (!userId) throw new GraphQLError('Not authenticated', {
        extensions: { code: 'UNAUTHENTICATED' }
      });
      
      await activatePendingChallenges();
    
      const challenges = await challengeModel.find({
        participants: {
          $elemMatch: {
            user: userId,
            status: 'pending'
          }
        }
      })
      .populate('participants.user', 'displayName email avatarUrl')
      .populate('createdBy', 'displayName email avatarUrl');
      
      // Add isCurrentUser field
      return challenges.map(challenge => addIsCurrentUserToParticipants(challenge, userId));
    },

    timelineMedia: async (_, __, { userId }) => {
      if (!userId) throw new GraphQLError('Not authenticated');
    
      const challenges = await challengeModel.find({
        participants: {
          $elemMatch: { user: userId }
        }
      });
    
      const challengeIds = challenges.map(c => c._id);
    
      // Get media with populated daily log data
      const mediaDocs = await mediaModel.find({
        challengeId: { $in: challengeIds }
      })
        .populate('user', 'displayName avatarUrl')
        .populate('comments.author', 'displayName avatarUrl')
        .populate('dailyLogId') // Populate the linked daily log
        .sort({ uploadedAt: -1 }); // Most recent first
    
      return mediaDocs.map(doc => {
        const media = doc.toObject({ virtuals: true });
    
        return {
          ...media,
          id: doc._id.toString(),
          cheers: (media.cheers || []).map(uid => uid.toString()),
    
          hasCheered: media.cheers?.some(
            uid => uid.toString() === userId.toString()
          ) || false,
    
          comments: (media.comments || []).map(comment => ({
            ...comment,
            id: comment._id?.toString(),
            author: comment.author
          })),

          // Include daily log data for richer timeline context
          dailyLog: media.dailyLogId ? {
            type: media.dailyLogId.type,
            activityType: media.dailyLogId.activityType,
            points: media.dailyLogId.points,
            date: media.dailyLogId.date
          } : null
        };
      });
    },
      
    challenges: async (_, __, { userId }) => {
      if (!userId) throw new GraphQLError('Not authenticated', {
        extensions: { code: 'UNAUTHENTICATED' }
      });
      
      await activatePendingChallenges();
    
      const challenges = await challengeModel.find({
        'participants.user': userId
      })
      .populate('participants.user', 'displayName email avatarUrl')
      .populate('createdBy', 'displayName email avatarUrl');
      
      // Add isCurrentUser field
      return challenges.map(challenge => addIsCurrentUserToParticipants(challenge, userId));
    },
    
    challenge: async (_, { id }, { userId }) => {
      if (!userId) throw new Error('Not authenticated');
    
      const challenge = await challengeModel.findById(id)
        .populate('participants.user', 'displayName email avatarUrl')
        .populate('createdBy', 'displayName email avatarUrl');
    
      const isParticipant = challenge?.participants.some(
        p => p.user._id.toString() === userId.toString()
      );
    
      if (!isParticipant) {
        throw new GraphQLError('Access denied to this challenge', {
          extensions: { code: 'FORBIDDEN' }
        });
      }
    
      // Add isCurrentUser field
      return addIsCurrentUserToParticipants(challenge, userId);
    },
    
    challengeAnalytics: async (_, { challengeId }, { userId }) => {
      if (!userId) throw new GraphQLError('Not authenticated');
      
      // Verify user is participant
      const challenge = await challengeModel.findById(challengeId);
      const isParticipant = challenge?.participants.some(
        p => p.user.toString() === userId.toString()
      );
      
      if (!isParticipant) {
        throw new GraphQLError('Not a participant in this challenge');
      }
      
      return await analyticsService.getChallengeAnalytics(challengeId, userId);
    },

    chatMessages: async (_, { challengeId, limit = 50, before }, { userId }) => {
      if (!userId) throw new GraphQLError('Not authenticated');
      
      const query = { challengeId };
      if (before) {
        query.createdAt = { $lt: new Date(before) };
      }
      
      return await chatMessageModel
        .find(query)
        .populate('user', 'displayName avatarUrl')
        .populate('reactions.user', 'displayName avatarUrl')
        .sort({ createdAt: -1 })
        .limit(limit);
    },

    availableBadges: async () => {
      return await badgeModel.find({});
    },

    userBadges: async (_, { userId }) => {
      const user = await userModel.findById(userId)
        .populate('badges.badge');
      
      return user.badges || [];
    },

    challengeTemplates: async () => {
      return ChallengeTemplates.getAll();
    },

    userNotifications: async (_, { limit = 20, unreadOnly }, { userId }) => {
      if (!userId) throw new GraphQLError('Not authenticated');
      
      const query = { userId };
      if (unreadOnly) {
        query.read = false;
      }
      
      return await notificationModel
        .find(query)
        .sort({ createdAt: -1 })
        .limit(limit);
    },

    challengeCalendarData: async (_, { challengeId, startDate, endDate }, { userId }) => {
      if (!userId) throw new GraphQLError('Not authenticated');
      
      const logs = await dailyLogModel.find({
        challengeId,
        date: { $gte: startDate, $lte: endDate }
      });
      
      const challenge = await challengeModel.findById(challengeId);
      const milestoneAchievements = [];
      
      // Get milestone achievements in date range
      for (const milestone of challenge.milestones) {
        const achievements = milestone.achievedBy.filter(
          a => a.achievedAt >= startDate && a.achievedAt <= endDate
        );
        milestoneAchievements.push(...achievements);
      }
      
      // Calculate missed days
      const missedDays = [];
      const current = new Date(startDate);
      while (current <= endDate) {
        const hasLog = logs.some(
          log => log.date.toDateString() === current.toDateString()
        );
        if (!hasLog) {
          missedDays.push(new Date(current));
        }
        current.setDate(current.getDate() + 1);
      }
      
      return {
        dailyLogs: logs,
        milestoneAchievements,
        missedDays
      };
    }
  },

  Mutation: {
    createUser: async (_, { input }) => {
      const user = await userModel.create({
        firebaseUid: input.firebaseUid,
        displayName: input.displayName,
        email: input.email,
        avatarUrl: input.avatarUrl
      });
      return user;
    },

    createChallenge: async (_, { input }, { userId }) => {
      if (!userId) throw new GraphQLError('Not authenticated');
      
      const mongoUser = await userModel.findById(userId);
      if (!mongoUser) throw new GraphQLError('User not found');
      
      const {
        title,
        description = '', // Default empty if not provided
        rules = '',
        sport,
        type,
        startDate,
        timeLimit,
        minWeeklyActivities = 4, // Default values
        minPointsToJoin = 0,
        allowedActivities = ['running', 'cycling', 'workout', 'other'],
        requireDailyPhoto = false,
        creatorRestDays = 1,
        participantIds,
        wager,
        template,
        milestones = [],
        enableReminders = true
      } = input;
      
      // Validate dates
      const start = new Date(startDate);
      const end = new Date(timeLimit);
      
      if (start >= end) {
        throw new GraphQLError('End date must be after start date', {
          extensions: { code: 'BAD_USER_INPUT' }
        });
      }
      
      // Build participants array with creator's rest days
      const participants = await buildParticipantsArray(participantIds, mongoUser._id);
      participants[0].restDays = creatorRestDays; // Creator is always first
      
      // Create milestones with IDs
      const challengeMilestones = milestones.map(m => ({
        id: new mongoose.Types.ObjectId().toString(),
        ...m,
        achievedBy: [],
        createdAt: new Date()
      }));
      
      // Create challenge
      const challenge = await challengeModel.create({
        title,
        description,
        rules,
        sport,
        type,
        startDate: start,
        timeLimit: end,
        minWeeklyActivities,
        minPointsToJoin,
        allowedActivities,
        requireDailyPhoto,
        creatorRestDays,
        wager,
        template,
        createdBy: mongoUser._id,
        participants,
        milestones: challengeMilestones,
        enableReminders,
        status: 'pending',
        chatEnabled: true,
        createdAt: new Date()
      });
      
      // Check and update status
      challenge.checkAndUpdateStatus();
      await challenge.save();
      
      // Schedule notifications
      if (enableReminders) {
        await notificationService.scheduleChallengeReminders(challenge);
      }
      
      // Send invite notifications
      for (const participantId of participantIds) {
        await notificationService.sendChallengeInvite(
          participantId,
          challenge.title,
          mongoUser._id
        );
      }
      
      // Populate before returning
      await challenge.populate('participants.user createdBy');
      
      // Add isCurrentUser field
      return addIsCurrentUserToParticipants(challenge, userId);
    },

    updateProgress: async (_, { challengeId, progress }, { userId }) => {
      const challenge = await challengeModel.findById(challengeId);
      const participant = challenge.participants.find(p => p.userId.toString() === userId);
      if (!participant) throw new Error('Participant not found');

      participant.progress = progress;
      await challenge.save();

      // 🔔 Publish update
      pubsub.publish(CHALLENGE_UPDATED, { challengeUpdated: challenge });

      return participant;
    },

    acceptChallenge: async (_, { challengeId, restDays }, { userId }) => {
      if (!userId) throw new Error('Not authenticated');
      if (restDays < 0 || restDays > 6) {
        throw new GraphQLError('Rest days must be between 0 and 6', {
          extensions: { code: 'BAD_USER_INPUT' }
        });
      }

      const challenge = await challengeModel.findById(challengeId);
      if (!challenge) {
        throw new GraphQLError('Challenge not found', {
          extensions: { code: 'NOT_FOUND' }
        });
      }

      const participant = challenge.participants.find(
        p => p.user.toString() === userId.toString()
      );

      if (!participant) {
        throw new GraphQLError('You were not invited to this challenge', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      if (participant.status === 'accepted') {
        throw new GraphQLError('You already accepted this challenge', {
          extensions: { code: 'ALREADY_EXISTS' }
        });
      }

      // Update participant with restDays and accept status
      participant.status = 'accepted';
      participant.restDays = restDays;
      participant.joinedAt = new Date();

      // Check if all participants have responded
      const allParticipantsResponded = challenge.participants.every(
        p => p.status === 'accepted' || p.status === 'rejected'
      );

      // If all participants have accepted, activate the challenge
      const allParticipantsAccepted = challenge.participants.every(
        p => p.status === 'accepted'
      );

      if (allParticipantsAccepted) {
        challenge.status = 'active';
      } else if (allParticipantsResponded) {
        // If some rejected but all have responded, expire the challenge
        challenge.status = 'expired';
      }

      await challenge.save();
      await challenge.populate('participants.user', 'displayName email avatarUrl');

      const updatedChallenge = addIsCurrentUserToParticipants(challenge, userId);
      const updatedParticipant = updatedChallenge.participants.find(
        p => p.user._id.toString() === userId.toString()
      );

      pubsub.publish(CHALLENGE_UPDATED, { challengeUpdated: updatedChallenge });

      return updatedParticipant;
    },

    declineChallenge: async (_, { challengeId, reason }, { userId }) => {
      if (!userId) throw new Error('Not authenticated');

      const challenge = await challengeModel.findById(challengeId);
      if (!challenge) {
        throw new GraphQLError('Challenge not found', {
          extensions: { code: 'NOT_FOUND' }
        });
      }

      const participant = challenge.participants.find(
        p => p.user.toString() === userId.toString()
      );

      if (!participant) {
        throw new GraphQLError('You were not invited to this challenge', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      if (participant.status !== 'pending') {
        throw new GraphQLError('You have already responded to this challenge', {
          extensions: { code: 'ALREADY_EXISTS' }
        });
      }

      // Update participant status to rejected
      participant.status = 'rejected';
      participant.rejectedAt = new Date();
      participant.rejectionReason = reason;

      // Check if all participants have responded
      const allParticipantsResponded = challenge.participants.every(
        p => p.status === 'accepted' || p.status === 'rejected'
      );

      if (allParticipantsResponded) {
        // Check if at least 2 participants accepted (for a valid challenge)
        const acceptedCount = challenge.participants.filter(
          p => p.status === 'accepted'
        ).length;

        if (acceptedCount >= 2) {
          challenge.status = 'active';
        } else {
          challenge.status = 'expired';
        }
      }

      await challenge.save();

      // Publish update to subscribers
      pubsub.publish(CHALLENGE_UPDATED, { challengeUpdated: challenge });

      return true;
    },

    logDailyActivity: async (_, { input }, { userId }) => {
      if (!userId) throw new GraphQLError('Not authenticated');
    
      const { challengeId, type, activityType, notes, date } = input;
      
      // Get the challenge - DON'T use .lean() here
      const challenge = await challengeModel.findById(challengeId);
      if (!challenge) throw new GraphQLError('Challenge not found');
    
      const participant = challenge.participants.find(
        p => p.user.toString() === userId.toString()
      );
      if (!participant) throw new GraphQLError('Not a participant in this challenge');
    
      // Check if already logged today
      const today = new Date(date);
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
    
      const existingLog = await dailyLogModel.findOne({
        challengeId,
        user: userId,
        date: { $gte: today, $lt: tomorrow }
      });
    
      if (existingLog) {
        throw new GraphQLError('Already logged activity for today');
      }
    
      // Calculate points based on type
      let points = 0;
      if (type === 'activity') {
        points = 10;
      } else if (type === 'rest') {
        // Check if user has rest days available
        const weekStart = getWeekStart(today);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
    
        const restDaysThisWeek = await dailyLogModel.countDocuments({
          challengeId,
          user: userId,
          type: 'rest',
          date: { $gte: weekStart, $lt: weekEnd }
        });
    
        if (restDaysThisWeek >= participant.restDays) {
          throw new GraphQLError('No rest days remaining this week');
        }
    
        points = 5;
      }
    
      // Create the daily log
      const dailyLog = await dailyLogModel.create({
        challengeId,
        participantId: participant._id,
        user: userId,
        type,
        activityType,
        notes,
        date: today,
        points
      });
    
      // Update participant stats
      participant.totalPoints = (participant.totalPoints || 0) + points;
      participant.lastLogDate = today;
      
      // Update streak
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const loggedYesterday = await dailyLogModel.findOne({
        challengeId,
        user: userId,
        date: { $gte: yesterday, $lt: today }
      });
    
      if (loggedYesterday || participant.dailyStreak === 0) {
        participant.dailyStreak = (participant.dailyStreak || 0) + 1;
      } else {
        participant.dailyStreak = 1; // Reset streak if gap found
      }
    
      // Save the challenge with updated participant
      await challenge.save();
    
      // Update challenge streak
      await updateChallengeStreakManually(challenge._id);
    
      // 🔔 Publish challenge update for real-time sync
      const updatedChallenge = await challengeModel.findById(challengeId)
        .populate('participants.user', 'displayName email avatarUrl');
        
      const challengeWithCurrentUser = addIsCurrentUserToParticipants(updatedChallenge, userId);
      pubsub.publish(CHALLENGE_UPDATED, { challengeUpdated: challengeWithCurrentUser });
    
      // Return the dailyLog with proper id field
      return {
        id: dailyLog._id.toString(),
        challengeId: dailyLog.challengeId.toString(),
        participantId: dailyLog.participantId.toString(),
        user: dailyLog.user.toString(),
        type: dailyLog.type,
        activityType: dailyLog.activityType,
        notes: dailyLog.notes,
        date: dailyLog.date,
        points: dailyLog.points,
        createdAt: dailyLog.createdAt,
        participant: {
          dailyStreak: participant.dailyStreak,
          totalPoints: participant.totalPoints
        }
      };
    },

    addMedia: async (_, { input }, { userId }) => {
      if (!userId) {
        throw new Error('Unauthorized: You must be logged in to upload media.');
      }

      const { challengeId, url, type, caption } = input;

      // Check if user logged activity today (optional - link media to daily log)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayLog = await dailyLogModel.findOne({
        challengeId,
        user: userId,
        date: { $gte: today, $lt: tomorrow }
      });

      // Create the media entry
      const newMedia = await mediaModel.create({
        challengeId,
        url,
        type,
        caption,
        uploadedAt: new Date(),
        user: userId,
        cheers: [],
        comments: [],
        // Optional: Link to daily log if exists
        dailyLogId: todayLog?._id
      });
      
      const populatedMedia = await mediaModel.findById(newMedia._id)
        .populate('user', 'displayName avatarUrl');

      // 🔔 Publish media update for real-time timeline updates
      pubsub.publish(MEDIA_ADDED, { 
        mediaAdded: populatedMedia,
        challengeId 
      });
      
      return populatedMedia;
    },

    cheerPost: async (_, { mediaId}, { userId }) => {
      if (!userId) throw new Error('Not authenticated');
    
      const media = await mediaModel.findById(mediaId);
      if (!media) throw new Error('Media not found');
    
      const alreadyCheered = media.cheers.some(uid => uid.toString() === userId.toString());
    
      if (!alreadyCheered) {
        media.cheers.push(userId);
        await media.save();
      }
    
      return true;
    },
    
    uncheerPost: async (_, { mediaId}, { userId }) => {
      if (!userId) throw new Error('Not authenticated');
    
      const media = await mediaModel.findById(mediaId);
      if (!media) throw new Error('Media not found');
    
      media.cheers = media.cheers.filter(uid => uid.toString() !== userId.toString());
      await media.save();
    
      return true;
    },

    addComment: async (_, { input }, { userId }) => {
      if (!userId) throw new GraphQLError('Not authenticated', {
        extensions: { code: 'UNAUTHENTICATED' }
      });
    
      const { mediaId, text } = input;
    
      const media = await mediaModel.findById(mediaId);
      if (!media) throw new GraphQLError('Media not found');
    
      const newComment = {
        text,
        author: userId,
        createdAt: new Date()
      };
    
      media.comments.unshift(newComment); // will auto-generate `_id`
      await media.save();
    
      // Re-fetch the just-saved comment, fully populated
      const updated = await mediaModel.findById(mediaId)
        .populate('comments.author', 'displayName avatarUrl');
    
      const saved = updated.comments.find(
        c => c.text === text && c.author._id.toString() === userId.toString()
      );
    
      if (!saved) throw new GraphQLError('Failed to retrieve comment after save');
    
      return {
        id: saved._id.toString(),
        text: saved.text,
        createdAt: saved.createdAt,
        author: saved.author
      };
    },

    addMilestone: async (_, { challengeId, milestone }, { userId }) => {
      if (!userId) throw new GraphQLError('Not authenticated');
      
      const challenge = await challengeModel.findById(challengeId);
      if (!challenge) throw new GraphQLError('Challenge not found');
      
      // Check if user is creator or admin
      const participant = challenge.participants.find(
        p => p.user.toString() === userId.toString()
      );
      
      if (!participant || !['creator', 'admin'].includes(participant.role)) {
        throw new GraphQLError('Only creator or admin can add milestones');
      }
      
      const newMilestone = {
        id: new mongoose.Types.ObjectId().toString(),
        ...milestone,
        achievedBy: [],
        createdAt: new Date()
      };
      
      challenge.milestones.push(newMilestone);
      await challenge.save();
      
      // Notify all participants
      await notificationService.notifyNewMilestone(
        challenge,
        newMilestone
      );
      
      return newMilestone;
    },

    sendChatMessage: async (_, { input }, { userId }) => {
      if (!userId) throw new GraphQLError('Not authenticated');
      
      const { challengeId, text, type, metadata } = input;
      
      // Verify user is participant
      const challenge = await challengeModel.findById(challengeId);
      const isParticipant = challenge?.participants.some(
        p => p.user.toString() === userId.toString()
      );
      
      if (!isParticipant) {
        throw new GraphQLError('Not a participant in this challenge');
      }
      
      const message = await chatMessageModel.create({
        challengeId,
        user: userId,
        text,
        type,
        metadata,
        reactions: []
      });
      
      await message.populate('user', 'displayName avatarUrl');
      
      // Update challenge last chat activity
      challenge.lastChatActivity = new Date();
      await challenge.save();
      
      // Publish to subscribers
      pubsub.publish(`CHAT_MESSAGE_${challengeId}`, {
        chatMessageAdded: message
      });
      
      // Send push notifications to other participants
      await notificationService.notifyChatMessage(
        challenge,
        message,
        userId
      );
      
      return message;
    },

    addReaction: async (_, { input }, { userId }) => {
      if (!userId) throw new GraphQLError('Not authenticated');
      
      const { messageId, emoji } = input;
      
      const message = await chatMessageModel.findById(messageId);
      if (!message) throw new GraphQLError('Message not found');
      
      // Check if user already reacted with this emoji
      const existingReaction = message.reactions.find(
        r => r.user.toString() === userId.toString() && r.emoji === emoji
      );
      
      if (!existingReaction) {
        message.reactions.push({
          user: userId,
          emoji,
          createdAt: new Date()
        });
        await message.save();
      }
      
      await message.populate('user reactions.user');
      
      // Publish update
      pubsub.publish(`CHAT_MESSAGE_${message.challengeId}`, {
        chatMessageUpdated: message
      });
      
      return message;
    },

    markNotificationRead: async (_, { notificationId }, { userId }) => {
      if (!userId) throw new GraphQLError('Not authenticated');
      
      const notification = await notificationModel.findOneAndUpdate(
        { _id: notificationId, userId },
        { read: true },
        { new: true }
      );
      
      if (!notification) throw new GraphQLError('Notification not found');
      
      return notification;
    },

    updateNotificationSettings: async (_, args, { userId }) => {
      if (!userId) throw new GraphQLError('Not authenticated');
      
      const user = await userModel.findByIdAndUpdate(
        userId,
        {
          notificationSettings: {
            enableDailyReminders: args.enableDailyReminders,
            reminderTime: args.reminderTime,
            enableSocialNotifications: args.enableSocialNotifications,
            enableAchievementNotifications: args.enableAchievementNotifications
          }
        },
        { new: true }
      );
      
      return user;
    }
  },

  Subscription: {
    challengeUpdated: {
      subscribe: () => pubsub.asyncIterator([CHALLENGE_UPDATED]),
      resolve: (payload, _, { userId }) => {
        // Add isCurrentUser field to subscription updates
        return addIsCurrentUserToParticipants(payload.challengeUpdated, userId);
      },
    mediaAdded: {
      subscribe: (_, { challengeId }) => pubsub.asyncIterator([`${MEDIA_ADDED}_${challengeId}`]),
      resolve: (payload) => payload.mediaAdded
      }
    },

    chatMessageAdded: {
      subscribe: (_, { challengeId }) => 
        pubsub.asyncIterator([`CHAT_MESSAGE_${challengeId}`])
    },

    chatMessageUpdated: {
      subscribe: (_, { challengeId }) => 
        pubsub.asyncIterator([`CHAT_MESSAGE_UPDATE_${challengeId}`])
    },

    milestoneAchieved: {
      subscribe: (_, { challengeId }) => 
        pubsub.asyncIterator([`MILESTONE_ACHIEVED_${challengeId}`])
    },

    challengeAnalyticsUpdated: {
      subscribe: (_, { challengeId }) => 
        pubsub.asyncIterator([`ANALYTICS_UPDATE_${challengeId}`])
    }
  },

  Media: {
    hasCheered: (media, _, { userId }) => {
      console.log('[hasCheered] checking for:', userId);
      console.log('[hasCheered] media.cheers:', media.cheers);
      if (!userId) return false;
      return (media.cheers || []).some(
        uid => uid.toString() === userId.toString()
      );
    }
  },
  
  // Enhanced resolvers for linked data
  DailyLog: {
    media: async (dailyLog) => {
      return await mediaModel.find({ dailyLogId: dailyLog._id })
        .populate('user', 'displayName avatarUrl');
    },
    participant: async (dailyLog) => {
      const challenge = await challengeModel.findById(dailyLog.challengeId);
      return challenge.participants.find(
        p => p._id.toString() === dailyLog.participantId.toString()
      );
    }
  },

  Challenge: {
    todayStatus: async (challenge, _, { userId }) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const acceptedParticipants = challenge.participants.filter(
        p => p.status === 'accepted'
      );
      
      const participantsStatus = await Promise.all(
        acceptedParticipants.map(async (participant) => {
          const todayLog = await dailyLogModel.findOne({
            challengeId: challenge._id,
            user: participant.user._id || participant.user,
            date: { $gte: today, $lt: tomorrow }
          });
          
          return {
            participant,
            hasLoggedToday: !!todayLog,
            lastLogTime: todayLog?.createdAt || null
          };
        })
      );
      
      const loggedCount = participantsStatus.filter(p => p.hasLoggedToday).length;
      
      return {
        allParticipantsLogged: loggedCount === acceptedParticipants.length,
        participantsLoggedCount: loggedCount,
        totalParticipants: acceptedParticipants.length,
        participantsStatus
      };
    },
    analytics: async (challenge, _, { userId }) => {
      return await analyticsService.getChallengeAnalytics(
        challenge._id,
        userId
      );
    }
  },
}

