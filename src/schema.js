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
    dailyLogId: ID
    dailyLog: DailyLog
  }

  type DailyLog {
    id: ID!
    challengeId: ID!
    participantId: ID!
    user: User!
    type: LogType!
    activityType: String
    notes: String
    date: Date!
    points: Int!
    createdAt: Date!
    media: [Media!]  # Media uploaded for this log entry
    participant: Participant  # Updated participant data
  }

  enum LogType {
    activity
    rest
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
    totalPoints: Int
    weeklyRestDaysUsed: Int
    lastLogDate: Date
    isCurrentUser: Boolean! 
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
    startDate: Date!
    timeLimit: Date!
    wager: String
    createdBy: User!
    participants: [Participant!]!
    createdAt: Date
    status: ChallengeStatus
    challengeStreak: Int!  # NEW
    lastCompleteLogDate: Date  # NEW
    todayStatus: ChallengeTodayStatus!  # NEW
  }

  type ChallengeTodayStatus {
    allParticipantsLogged: Boolean!
    participantsLoggedCount: Int!
    totalParticipants: Int!
    participantsStatus: [ParticipantDailyStatus!]!
  }

  type ParticipantDailyStatus {
    participant: Participant!
    hasLoggedToday: Boolean!
    lastLogTime: Date
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

  type UserStats {
    currentStreak: Int!
    totalPoints: Int!
    completedChallenges: Int!
    activeChallenge: ActiveChallengeInfo
  }

  type ActiveChallengeInfo {
    id: ID!
    title: String!
    allowedRestDays: Int!
    usedRestDaysThisWeek: Int!
    hasLoggedToday: Boolean!
  }

  type WeeklyProgress {
    weekStart: Date!
    weekEnd: Date!
    activityDays: Int!
    restDays: Int!
    totalPoints: Int!
    logs: [DailyLog!]!
  }

  type Query {
    userStats: UserStats!
    media(challengeId: ID!): [Media!]!
    mediaByChallenge(challengeId: ID!): [Media!]!
    timelineMedia: [Media!]!
    pendingChallenges: [Challenge!]!
    challenges: [Challenge!]!
    challenge(id: ID!): Challenge
    dailyLogs(challengeId: ID!): [DailyLog!]!
    weeklyProgress(challengeId: ID!): WeeklyProgress!
  }

  type Mutation {
    createUser(input: CreateUserInput!): User!
    createChallenge(input: CreateChallengeInput!): Challenge!
    acceptChallenge(challengeId: ID!, restDays: Int!): Participant!
    declineChallenge(challengeId: ID!, reason: String): Boolean!
    updateProgress(challengeId: ID!, progress: Float!): Participant!
    addParticipantMedia(input: AddParticipantMediaInput!): Media!
    addMedia(input: AddMediaInput!): Media!
    cheerPost(mediaId: ID!): Boolean!
    uncheerPost(mediaId: ID!): Boolean!
    addComment(input: AddCommentInput!): Comment!
    logDailyActivity(input: LogActivityInput!): DailyLog!
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
    startDate: Date!
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

  input LogActivityInput {
    challengeId: ID!
    type: LogType!
    activityType: String
    notes: String
    date: Date!
  }

  type Subscription {
    challengeUpdated: Challenge
    mediaAdded(challengeId: ID!): Media
  }
`;
