import { gql } from 'graphql-tag';

export const typeDefs = gql`#graphql
  scalar Date
  scalar JSON

  # ============ USER & AUTH ============
  
  type User {
    id: ID!
    firebaseUid: String!
    displayName: String!
    email: String!
    avatarUrl: String
    createdAt: Date!
    
    # Notification settings
    notificationSettings: NotificationSettings
    fcmToken: String
    
    # Badges
    badges: [BadgeEarned!]!
  }
  
  type NotificationSettings {
    enableDailyReminders: Boolean!
    reminderTime: String!
    enableSocialNotifications: Boolean!
    enableAchievementNotifications: Boolean!
  }

  # ============ CHALLENGE ============
  
  type Challenge {
    id: ID!
    # Basic info
    title: String!
    description: String
    rules: [String]
    sport: Sport!
    type: ChallengeType!
    startDate: Date!
    timeLimit: Date!
    wager: String
    status: ChallengeStatus!
    
    # Requirements
    minWeeklyActivities: Int!
    minPointsToJoin: Int!
    allowedActivities: [String!]!
    requireDailyPhoto: Boolean!
    creatorRestDays: Int!
    
    # Template
    template: String
    
    # Notifications
    enableReminders: Boolean!
    reminderTime: String
    
    # Relations
    createdBy: User!
    participants: [Participant!]!
    milestones: [Milestone!]!
    
    # Tracking
    challengeStreak: Int!
    lastCompleteLogDate: Date
    todayStatus: ChallengeTodayStatus!
    createdAt: Date!
    
    # Analytics
    analytics: ChallengeAnalytics
    
    # Chat
    chatEnabled: Boolean!
    lastChatActivity: Date
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

  # ============ PARTICIPANT ============
  
  type Participant {
    id: ID!
    user: User!
    role: ParticipantRole!
    status: ParticipantStatus!
    
    # Progress tracking
    progress: Float!
    dailyStreak: Int!
    totalPoints: Int!
    weeklyRestDaysUsed: Int!
    
    # Settings
    restDays: Int
    
    # Dates
    joinedAt: Date
    lastPostDate: Date
    lastLogDate: Date
    
    # Relations
    media: [Media!]!
    
    # Computed
    isCurrentUser: Boolean!
  }

  # ============ DAILY LOGS ============
  
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
    
    # Relations
    media: [Media!]!
    participant: Participant
  }

  # ============ MEDIA ============
  
  type Media {
    id: ID!
    challengeId: ID!
    user: User!
    url: String!
    type: MediaType!
    caption: String
    uploadedAt: Date!
    
    # Social features
    cheers: [String!]!
    comments: [Comment!]!
    hasCheered: Boolean!
    
    # Relations
    dailyLogId: ID
    dailyLog: DailyLog
  }

  type Comment {
    id: ID!
    text: String!
    author: User!
    createdAt: Date!
  }

  # ============ MILESTONES ============
  
  type Milestone {
    id: ID!
    title: String!  # Changed from 'name' to 'title'
    description: String
    type: MilestoneType!
    targetValue: Int!  # Changed from 'target' to 'targetValue'
    icon: String!
    reward: String
    achievedBy: [MilestoneAchievement!]!
    createdAt: Date!
  }
  
  type MilestoneAchievement {
    user: User!
    achievedAt: Date!
  }

  # ============ BADGES ============
  
  type Badge {
    id: ID!
    type: String!
    name: String!
    description: String!
    icon: String!
    category: BadgeCategory!
    criteria: BadgeCriteria!
  }
  
  type BadgeCriteria {
    type: String!
    value: Int!
  }
  
  type BadgeEarned {
    badge: Badge!
    user: User!
    earnedAt: Date!
    challengeId: ID
  }

  # ============ CHAT ============
  
  type ChatMessage {
    id: ID!
    challengeId: ID!
    user: User!
    text: String!
    type: MessageType!
    metadata: JSON
    createdAt: Date!
    editedAt: Date
    reactions: [MessageReaction!]!
  }
  
  type MessageReaction {
    user: User!
    emoji: String!
    createdAt: Date!
  }

  # ============ ANALYTICS ============
  
  type ChallengeAnalytics {
    overview: AnalyticsOverview!
    activityDistribution: [ActivityDistribution!]!
    weeklyProgress: [WeeklyProgress!]!
    personalRecords: [PersonalRecord!]!
    patterns: UserPatterns!
  }
  
  type AnalyticsOverview {
    totalDays: Int!
    activeDays: Int!
    restDays: Int!
    missedDays: Int!
    totalPoints: Int!
    averagePointsPerDay: Float!
    longestStreak: Int!
    currentStreak: Int!
  }
  
  type ActivityDistribution {
    type: String!
    count: Int!
    percentage: Float!
  }
  
  type PersonalRecord {
    type: String!
    value: Int!
    date: Date!
    description: String!
  }
  
  type UserPatterns {
    mostActiveDay: String!
    mostActiveTime: String!
    preferredActivity: String!
    averageSessionDuration: Int
  }
  
  type WeeklyProgress {
    week: Int!
    points: Int!
    activities: Int!
  }

  # ============ NOTIFICATIONS ============
  
  type Notification {
    id: ID!
    user: User!
    type: NotificationType!
    title: String!
    body: String!
    data: JSON
    read: Boolean!
    createdAt: Date!
  }

  # ============ TEMPLATES ============
  
  type ChallengeTemplate {
    id: ID!
    title: String!
    description: String!
    rules: [String]
    sport: Sport!
    minWeeklyActivities: Int!
    allowedActivities: [String!]!
    suggestedMilestones: [Milestone!]!
    icon: String!
  }

  # ============ USER STATS ============
  
  type UserStats {
    currentStreak: Int!
    totalPoints: Int!
    completedChallenges: Int!
    activeChallenge: ActiveChallengeInfo
    weeklyActivityDays: Int!
    weeklyRestDays: Int!
    weeklyPoints: Int!
  }

  type ActiveChallengeInfo {
    id: ID!
    title: String!
    allowedRestDays: Int!
    usedRestDaysThisWeek: Int!
    hasLoggedToday: Boolean!
  }

  # ============ CALENDAR ============
  
  type CalendarData {
    dailyLogs: [DailyLog!]!
    milestoneAchievements: [MilestoneAchievement!]!
    missedDays: [Date!]!
  }

  # ============ ENUMS ============
  
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

  enum LogType {
    activity
    rest
  }

  enum MediaType {
    photo
    video
  }

  enum MilestoneType {
    points
    streak
    activities
    custom
  }

  enum BadgeCategory {
    streak
    points
    social
    milestone
    special
  }

  enum MessageType {
    text
    achievement
    milestone
    system
    celebration
  }

  enum NotificationType {
    reminder
    achievement
    social
    milestone
    streak_warning
    challenge_invite
  }

  # ============ QUERIES ============
  
  type Query {
    # User
    userStats: UserStats!
    
    # Challenges
    challenges: [Challenge!]!
    challenge(id: ID!): Challenge
    pendingChallenges: [Challenge!]!
    
    # Media
    media(challengeId: ID!): [Media!]!
    mediaByChallenge(challengeId: ID!): [Media!]!
    timelineMedia: [Media!]!
    
    # Daily Logs
    dailyLogs(challengeId: ID!): [DailyLog!]!
    weeklyProgress(challengeId: ID!): WeeklyProgress!
    
    # Analytics
    challengeAnalytics(challengeId: ID!): ChallengeAnalytics!
    challengeCalendarData(
      challengeId: ID!
      startDate: Date!
      endDate: Date!
    ): CalendarData!
    
    # Chat
    chatMessages(
      challengeId: ID!
      limit: Int
      before: String
    ): [ChatMessage!]!
    
    # Badges
    availableBadges: [Badge!]!
    userBadges(userId: ID!): [BadgeEarned!]!
    
    # Templates
    challengeTemplates: [ChallengeTemplate!]!
    
    # Notifications
    userNotifications(
      limit: Int
      unreadOnly: Boolean
    ): [Notification!]!
  }

  # ============ MUTATIONS ============
  
  type Mutation {
    # User
    createUser(input: CreateUserInput!): User!
    updateNotificationSettings(
      enableDailyReminders: Boolean
      reminderTime: String
      enableSocialNotifications: Boolean
      enableAchievementNotifications: Boolean
    ): User!
    
    # Challenge
    createChallenge(input: CreateChallengeInput!): Challenge!
    acceptChallenge(challengeId: ID!, restDays: Int!): Participant!
    declineChallenge(challengeId: ID!, reason: String): Boolean!
    updateProgress(challengeId: ID!, progress: Float!): Participant!
    
    # Daily Logs
    logDailyActivity(input: LogActivityInput!): DailyLog!
    
    # Media
    addMedia(input: AddMediaInput!): Media!
    addParticipantMedia(input: AddParticipantMediaInput!): Media!
    
    # Social
    cheerPost(mediaId: ID!): Boolean!
    uncheerPost(mediaId: ID!): Boolean!
    addComment(input: AddCommentInput!): Comment!
    
    # Milestones
    addMilestone(
      challengeId: ID!
      milestone: CreateMilestoneInput!
    ): Milestone!
    updateMilestone(
      challengeId: ID!
      milestoneId: ID!
      updates: CreateMilestoneInput!
    ): Milestone!
    deleteMilestone(
      challengeId: ID!
      milestoneId: ID!
    ): Boolean!
    
    # Chat
    sendChatMessage(input: SendMessageInput!): ChatMessage!
    addReaction(input: AddReactionInput!): ChatMessage!
    removeReaction(messageId: ID!, emoji: String!): ChatMessage!
    
    # Notifications
    markNotificationRead(notificationId: ID!): Notification!
    markAllNotificationsRead: Boolean!
    
    # Badges
    awardBadge(
      userId: ID!
      badgeType: String!
      challengeId: ID
    ): BadgeEarned!
  }

  # ============ SUBSCRIPTIONS ============
  
  type Subscription {
    # Challenge updates
    challengeUpdated: Challenge
    
    # Media
    mediaAdded(challengeId: ID!): Media
    
    # Chat
    chatMessageAdded(challengeId: ID!): ChatMessage!
    chatMessageUpdated(challengeId: ID!): ChatMessage!
    
    # Milestones
    milestoneAchieved(challengeId: ID!): MilestoneAchievement!
    
    # Analytics
    challengeAnalyticsUpdated(challengeId: ID!): ChallengeAnalytics!
  }

  # ============ INPUT TYPES ============
  
  input CreateUserInput {
    firebaseUid: String!
    displayName: String!
    email: String!
    avatarUrl: String
  }

  input CreateChallengeInput {
    # Basic info
    title: String!
    description: String
    sport: Sport!
    type: ChallengeType!
    startDate: Date!
    timeLimit: Date!  # This is what backend expects (not endDate)
    wager: String
    
    # Requirements
    rules: [String]
    minWeeklyActivities: Int
    minPointsToJoin: Int
    allowedActivities: [String!]
    requireDailyPhoto: Boolean
    creatorRestDays: Int
    
    # Template
    template: String  # Backend expects 'template', not 'templateId'
    enableReminders: Boolean
    
    # Participants
    participantIds: [String!]!
    
    # Milestones - ensure these field names match
    milestones: [CreateMilestoneInput!]
  }

  input CreateMilestoneInput {
    title: String!  
    description: String
    type: MilestoneType!
    targetValue: Int! 
    icon: String!
    reward: String
  }

  input AddMediaInput {
    challengeId: ID!
    url: String!
    type: MediaType!
    caption: String
  }

  input AddParticipantMediaInput {
    challengeId: ID!
    url: String!
    type: MediaType!
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

  input SendMessageInput {
    challengeId: ID!
    text: String!
    type: MessageType!
    metadata: JSON
  }

  input AddReactionInput {
    messageId: ID!
    emoji: String!
  }
`;
