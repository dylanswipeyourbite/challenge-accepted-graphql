import { PubSub } from 'graphql-subscriptions';
import { challengeModel } from './models/Challenge.js';
import { userModel } from './models/User.js'; 
import { mediaModel } from './models/Media.js'; 
import { GraphQLScalarType, Kind, GraphQLError } from 'graphql';
import { buildParticipantsArray } from './utils/buildParticipantsArray.js';

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

export const resolvers = {
  Date: dateScalar,

  Query: {
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
      if (!userId) throw new GraphQLError('Not authenticated', {
        extensions: { code: 'UNAUTHENTICATED' }
      });
    
      const challenges = await challengeModel.find({
        participants: {
          $elemMatch: { user: userId }
        }
      });
    
      const challengeIds = challenges.map(c => c._id);
    
      const mediaDocs = await mediaModel.find({
        challengeId: { $in: challengeIds }
      })
        .populate('user', 'displayName avatarUrl')
        .populate('comments.author', 'displayName avatarUrl');
    
      return mediaDocs.map(doc => {
        const media = doc.toObject({ virtuals: true });
    
        return {
          ...media,
          id: doc._id.toString(), // ensure ID is stringified
          cheers: (media.cheers || []).map(uid => uid.toString()),
    
          hasCheered: media.cheers?.some(
            uid => uid.toString() === userId.toString()
          ) || false,
    
          comments: (media.comments || []).map(comment => ({
            ...comment,
            id: comment._id?.toString(),
            author: comment.author
          }))
        };
      });
    },
    
      
    challenges: async (_, __, { userId }) => {
      console.log('test');
      console.log(userId);
      if (!userId) throw new GraphQLError('Not authenticated', {
        extensions: { code: 'UNAUTHENTICATED' }
      });
    
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
      const mongoUser = await userModel.findOne({ firebaseUid: userId });
      if (!mongoUser) throw new Error('User not found');
  
      const { title, sport, type, timeLimit, wager, participantIds } = input;
  
      const participants = await buildParticipantsArray(participantIds); 
  
      const challenge = await challengeModel.create({
        title,
        sport,
        type,
        timeLimit,
        wager,
        createdBy: mongoUser._id, 
        participants,
        status: 'pending',
        createdAt: new Date()
      });
  
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
    
      await challenge.save();
    
      // 🔔 Publish update to subscribers
      pubsub.publish(CHALLENGE_UPDATED, { challengeUpdated: challenge });
    
      return participant;
    },
    
    addMedia: async (_, { input }, { userId }) => {
      if (!userId) {
        throw new Error('Unauthorized: You must be logged in to upload media.');
      }

      const newMedia = await mediaModel.create({
        challengeId: input.challengeId,
        url: input.url,
        type: input.type,
        caption: input.caption,
        uploadedAt: new Date(),
        user: userId,
        cheers: [],
        comments: [],

      });
      
      return newMedia.populate('user'); 
      
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
  }    
};
