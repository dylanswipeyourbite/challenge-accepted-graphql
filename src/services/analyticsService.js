export const analyticsService = {
    async getChallengeAnalytics(challengeId, userId) {
      const challenge = await challengeModel.findById(challengeId);
      const participant = challenge.participants.find(
        p => p.user.toString() === userId.toString()
      );
      
      const logs = await dailyLogModel.find({
        challengeId,
        user: userId
      }).sort({ date: 1 });
      
      // Calculate overview
      const totalDays = Math.ceil(
        (new Date() - challenge.startDate) / (1000 * 60 * 60 * 24)
      );
      const activeDays = logs.filter(l => l.type === 'activity').length;
      const restDays = logs.filter(l => l.type === 'rest').length;
      const missedDays = totalDays - activeDays - restDays;
      const totalPoints = participant.totalPoints || 0;
      const averagePointsPerDay = totalDays > 0 ? totalPoints / totalDays : 0;
      
      // Activity distribution
      const activityCounts = {};
      logs.forEach(log => {
        if (log.activityType) {
          activityCounts[log.activityType] = (activityCounts[log.activityType] || 0) + 1;
        }
      });
      
      const totalActivities = Object.values(activityCounts).reduce((a, b) => a + b, 0);
      const activityDistribution = Object.entries(activityCounts).map(([type, count]) => ({
        type,
        count,
        percentage: totalActivities > 0 ? (count / totalActivities) * 100 : 0
      }));
      
      // Weekly progress
      const weeklyProgress = this.calculateWeeklyProgress(logs, challenge.startDate);
      
      // Personal records
      const personalRecords = this.calculatePersonalRecords(logs, participant);
      
      // Patterns
      const patterns = this.analyzePatterns(logs);
      
      return {
        overview: {
          totalDays,
          activeDays,
          restDays,
          missedDays,
          totalPoints,
          averagePointsPerDay,
          longestStreak: participant.longestStreak || participant.dailyStreak,
          currentStreak: participant.dailyStreak
        },
        activityDistribution,
        weeklyProgress,
        personalRecords,
        patterns
      };
    },
    
    calculateWeeklyProgress(logs, startDate) {
      const weeks = {};
      
      logs.forEach(log => {
        const weekNumber = Math.floor(
          (log.date - startDate) / (1000 * 60 * 60 * 24 * 7)
        );
        
        if (!weeks[weekNumber]) {
          weeks[weekNumber] = { week: weekNumber + 1, points: 0, activities: 0 };
        }
        
        weeks[weekNumber].points += log.points;
        if (log.type === 'activity') {
          weeks[weekNumber].activities += 1;
        }
      });
      
      return Object.values(weeks).sort((a, b) => a.week - b.week);
    },
    
    calculatePersonalRecords(logs, participant) {
      const records = [];
      
      // Longest streak
      records.push({
        type: 'longest_streak',
        value: participant.longestStreak || participant.dailyStreak,
        date: new Date(),
        description: 'Longest consecutive days'
      });
      
      // Most points in a day
      let maxPoints = 0;
      let maxPointsDate = null;
      logs.forEach(log => {
        if (log.points > maxPoints) {
          maxPoints = log.points;
          maxPointsDate = log.date;
        }
      });
      
      if (maxPoints > 0) {
        records.push({
          type: 'max_points_day',
          value: maxPoints,
          date: maxPointsDate,
          description: 'Most points earned in a single day'
        });
      }
      
      // Most activities in a week
      const weeklyActivities = {};
      logs.forEach(log => {
        if (log.type === 'activity') {
          const week = this.getWeekKey(log.date);
          weeklyActivities[week] = (weeklyActivities[week] || 0) + 1;
        }
      });
      
      const maxWeeklyActivities = Math.max(...Object.values(weeklyActivities));
      if (maxWeeklyActivities > 0) {
        records.push({
          type: 'max_weekly_activities',
          value: maxWeeklyActivities,
          date: new Date(),
          description: 'Most activities in a single week'
        });
      }
      
      return records;
    },
    
    analyzePatterns(logs) {
      const dayCount = {};
      const hourCount = {};
      const activityTypeCount = {};
      
      logs.forEach(log => {
        // Day of week
        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][log.date.getDay()];
        dayCount[dayName] = (dayCount[dayName] || 0) + 1;
        
        // Hour of day
        const hour = log.createdAt.getHours();
        const timeSlot = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
        hourCount[timeSlot] = (hourCount[timeSlot] || 0) + 1;
        
        // Activity type
        if (log.activityType) {
          activityTypeCount[log.activityType] = (activityTypeCount[log.activityType] || 0) + 1;
        }
      });
      
      // Find most common patterns
      const mostActiveDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'No data';
      const mostActiveTime = Object.entries(hourCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'No data';
      const preferredActivity = Object.entries(activityTypeCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'No data';
      
      return {
        mostActiveDay,
        mostActiveTime,
        preferredActivity,
        averageSessionDuration: null // Could calculate from timestamps if tracked
      };
    },
    
    getWeekKey(date) {
      const year = date.getFullYear();
      const week = Math.floor((date - new Date(year, 0, 1)) / (1000 * 60 * 60 * 24 * 7));
      return `${year}-W${week}`;
    }
  };