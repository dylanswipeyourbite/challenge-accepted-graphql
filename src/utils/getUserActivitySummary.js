export const getUserActivitySummary = async (userId) => {
    const today = new Date();
    const weekStart = weekStart(today);
    
    // Get this week's logs
    const weeklyLogs = await dailyLogModel.find({
      user: userId,
      date: { $gte: weekStart, $lt: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000) }
    });
  
    // Get current streak from most recent challenge
    const latestChallenge = await challengeModel.findOne({
      'participants.user': userId,
      status: { $in: ['active', 'pending'] }
    }).populate('participants.user');
  
    const participant = latestChallenge?.participants.find(
      p => p.user._id.toString() === userId.toString()
    );
  
    return {
      weeklyActivityDays: weeklyLogs.filter(log => log.type === 'activity').length,
      weeklyRestDays: weeklyLogs.filter(log => log.type === 'rest').length,
      weeklyPoints: weeklyLogs.reduce((sum, log) => sum + log.points, 0),
      currentStreak: participant?.dailyStreak || 0,
      totalPoints: participant?.totalPoints || 0
    };
};