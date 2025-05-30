import { PubSub } from 'graphql-subscriptions';
import { challengeModel } from './models/Challenge.js';
import { userModel } from './models/User.js'; 
import { mediaModel } from './models/Media.js'; 
import { GraphQLScalarType, Kind, GraphQLError } from 'graphql';
import { buildParticipantsArray } from './utils/buildParticipantsArray.js';
import { getUserActivitySummary } from './utils/getUserActivitySummary.js';
import { activatePendingChallenges } from './utils/activatePendingChallenges.js';
import { dailyLogModel } from './models/DailyLog.js';

const pubsub = new PubSub();

export const getPubSub = () => pubsub;

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

// SUBSCRIPTION FOR REAL-TIME UPDATES
const MEDIA_ADDED = 'MEDIA_ADDED';
const CHALLENGE_UPDATED = 'CHALLENGE_UPDATED';

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
      
      // Check and activate any pending challenges first
      await activatePendingChallenges();
    
      return await challengeModel.find({
        participants: {
          $elemMatch: {
            user: userId,
            status: 'pending'
          }
        }
      })
      .populate('participants.user', 'displayName email avatarUrl')
      .populate('createdBy', 'displayName email avatarUrl');
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
      
      // Check and activate any pending challenges that should be active
      await activatePendingChallenges();
    
      return await challengeModel.find({
        'participants.user': userId
      })
      .populate('participants.user', 'displayName email avatarUrl')
      .populate('createdBy', 'displayName email avatarUrl');
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
    
      return challenge;
    },    
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
      if (!userId) throw new Error('Not authenticated');
      
      const mongoUser = await userModel.findById(userId);
      if (!mongoUser) throw new Error('User not found');
    
      const { title, sport, type, startDate, timeLimit, wager, participantIds } = input;
    
      // Validate dates
      const start = new Date(startDate);
      const end = new Date(timeLimit);
      
      if (start >= end) {
        throw new GraphQLError('End date must be after start date', {
          extensions: { code: 'BAD_USER_INPUT' }
        });
      }
    
      // Build participants array with creator ID
      const participants = await buildParticipantsArray(participantIds, mongoUser._id); 
    
      const challenge = await challengeModel.create({
        title,
        sport,
        type,
        startDate: start,
        timeLimit: end,
        wager,
        createdBy: mongoUser._id, 
        participants,
        status: 'pending', // Start as pending until start date
        createdAt: new Date()
      });
      
      // Check if should be active immediately (if start date is today/past)
      challenge.checkAndUpdateStatus();
      await challenge.save();
      
      // Populate before returning
      await challenge.populate('participants.user', 'displayName email avatarUrl');
      await challenge.populate('createdBy', 'displayName email avatarUrl');
    
      return challenge;
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

      // Populate the user field before returning
      await challenge.populate('participants.user', 'displayName email avatarUrl');

      const updatedParticipant = challenge.participants.find(
        p => p.user._id.toString() === userId.toString()
      );

      // Publish update to subscribers
      pubsub.publish(CHALLENGE_UPDATED, { challengeUpdated: challenge });

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
    
    // Get the challenge and participant
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

    await challenge.save();

    // 🔔 Publish challenge update for real-time sync
    pubsub.publish(CHALLENGE_UPDATED, { challengeUpdated: challenge });

    return {
      ...dailyLog.toObject(),
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
  },

  Subscription: {
    challengeUpdated: {
      subscribe: () => pubsub.asyncIterator([CHALLENGE_UPDATED])
    },
    mediaAdded: {
      subscribe: (_, { challengeId }) => pubsub.asyncIterator([`${MEDIA_ADDED}_${challengeId}`]),
      resolve: (payload) => payload.mediaAdded
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
};
