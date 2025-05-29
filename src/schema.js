import { gql } from 'graphql-tag';

export const typeDefs = gql`#graphql
  scalar Date

  type User {
    id: ID!
    displayName: String!
    email: String!
    avatarUrl: String
  }

  type Media {
    id: ID!
    challengeId: ID!
    user: User!
    url: String!
    type: MediaType!
    uploadedAt: Date!
    cheers: [String!]!
    comments: [Comment!]!
    hasCheered: Boolean! 
    caption: String
  }

  type Comment {
    id: ID!
    text: String!
    author: User!
    createdAt: Date!
  }

  enum MediaType {
    photo
    video
  }

  type Participant {
    id: ID!
    user: User!
    role: ParticipantRole!
    progress: Float
    status: ParticipantStatus
    joinedAt: Date
    media: [Media!]
    dailyStreak: Int
    lastPostDate: Date
    restDays: Int
  }

  enum ParticipantRole {
    creator
    admin
    participant
    spectator
  }

  enum ParticipantStatus {
    pending
    accepted
    rejected
    completed
  }

  type Challenge {
    id: ID!
    title: String!
    sport: Sport!
    type: ChallengeType!
    timeLimit: Date!
    wager: String
    createdBy: User!
    participants: [Participant!]!
    createdAt: Date
    status: ChallengeStatus
  }

  enum Sport {
    running
    cycling
    workout
  }

  enum ChallengeType {
    competitive
    collaborative
  }

  enum ChallengeStatus {
    pending
    active
    completed
    expired
  }

  type Query {
    media(challengeId: ID!): [Media!]!
    mediaByChallenge(challengeId: ID!): [Media!]!
    timelineMedia: [Media!]!
    pendingChallenges: [Challenge!]!
    challenges: [Challenge!]!
    challenge(id: ID!): Challenge
  }

  type Mutation {
    createUser(input: CreateUserInput!): User!
    createChallenge(input: CreateChallengeInput!): Challenge!
    acceptChallenge(challengeId: ID!, restDays: Int!): Participant!
    updateProgress(challengeId: ID!, progress: Float!): Participant!
    addParticipantMedia(input: AddParticipantMediaInput!): Media!
    addMedia(input: AddMediaInput!): Media!
    cheerPost(mediaId: ID!): Boolean!
    uncheerPost(mediaId: ID!): Boolean!
    addComment(input: AddCommentInput!): Comment!
  }

  input CreateUserInput {
    firebaseUid: String!
    displayName: String!
    email: String!
    avatarUrl: String
  }

  input CreateChallengeInput {
    title: String!
    sport: Sport!
    type: ChallengeType!
    timeLimit: Date!
    wager: String
    participantIds: [String!]!
  }

  input AddParticipantMediaInput {
    challengeId: ID!
    url: String!
    type: MediaType!
  }

  input AddMediaInput {
    challengeId: ID!
    url: String!
    type: MediaType!
    caption: String
  }

  input AddCommentInput {
    mediaId: ID!
    text: String!
  }

  type Subscription {
    challengeUpdated: Challenge
  }
`;
