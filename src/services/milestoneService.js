// File: graphql_challengeaccepted/src/services/milestoneService.js

import Milestone from '../models/Milestone.js';
import mongoose from 'mongoose';

export const milestoneService = {
  // Create milestones for a challenge
  async createMilestones(challengeId, milestones) {
    const createdMilestones = [];
    
    for (const milestone of milestones) {
      const milestoneData = {
        challengeId: new mongoose.Types.ObjectId(challengeId),
        name: milestone.name,
        type: milestone.type,
        target: milestone.target,
        description: milestone.description || null,
        currentProgress: 0,
        isCompleted: false,
        achievedBy: [],
        createdAt: new Date(),
      };
      
      const newMilestone = new Milestone(milestoneData);
      const savedMilestone = await newMilestone.save();
      createdMilestones.push(savedMilestone);
    }
    
    return createdMilestones;
  },

  // Get all milestones for a challenge
  async getMilestonesByChallengeId(challengeId) {
    return await Milestone.find({ challengeId }).lean();
  },

  // Update milestone progress
  async updateMilestoneProgress(milestoneId, userId, progress) {
    const milestone = await Milestone.findById(milestoneId);
    
    if (!milestone) {
      throw new Error('Milestone not found');
    }
    
    milestone.currentProgress = progress;
    
    // Check if milestone is completed
    if (progress >= milestone.target && !milestone.isCompleted) {
      milestone.isCompleted = true;
      milestone.completedAt = new Date();
      
      // Add achievement record
      const achievementExists = milestone.achievedBy.some(
        achievement => achievement.userId.toString() === userId
      );
      
      if (!achievementExists) {
        milestone.achievedBy.push({
          userId: new mongoose.Types.ObjectId(userId),
          achievedAt: new Date(),
          value: progress,
        });
      }
    }
    
    await milestone.save();
    return milestone;
  },

  // Mark milestone as achieved by a user
  async achieveMilestone(milestoneId, userId, value = null) {
    const milestone = await Milestone.findById(milestoneId);
    
    if (!milestone) {
      throw new Error('Milestone not found');
    }
    
    // Check if user already achieved this milestone
    const achievementExists = milestone.achievedBy.some(
      achievement => achievement.userId.toString() === userId
    );
    
    if (!achievementExists) {
      const achievement = {
        userId: new mongoose.Types.ObjectId(userId),
        achievedAt: new Date(),
      };
      
      if (value !== null) {
        achievement.value = value;
      }
      
      milestone.achievedBy.push(achievement);
      await milestone.save();
    }
    
    return milestone;
  },

  // Get milestone by ID
  async getMilestoneById(milestoneId) {
    return await Milestone.findById(milestoneId).lean();
  },

  // Delete all milestones for a challenge
  async deleteMilestonesByChallengeId(challengeId) {
    await Milestone.deleteMany({ challengeId });
  },

  // Calculate milestone progress based on activities
  async calculateMilestoneProgress(milestone, activities) {
    switch (milestone.type) {
      case 'points':
        return activities.reduce((total, activity) => total + (activity.points || 0), 0);
      
      case 'activities':
        return activities.length;
      
      case 'streak':
        return this.calculateStreak(activities);
      
      case 'custom':
        return milestone.currentProgress || 0;
      
      default:
        return 0;
    }
  },

  // Helper function to calculate streak
  calculateStreak(activities) {
    if (activities.length === 0) return 0;
    
    // Sort activities by date
    const sortedActivities = [...activities].sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );
    
    let currentStreak = 1;
    let maxStreak = 1;
    let previousDate = new Date(sortedActivities[0].date);
    
    for (let i = 1; i < sortedActivities.length; i++) {
      const currentDate = new Date(sortedActivities[i].date);
      const dayDifference = Math.floor(
        (currentDate - previousDate) / (1000 * 60 * 60 * 24)
      );
      
      if (dayDifference === 1) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else if (dayDifference > 1) {
        currentStreak = 1;
      }
      
      previousDate = currentDate;
    }
    
    return maxStreak;
  },

  // Update milestones based on new activity
  async updateMilestonesForActivity(challengeId, userId, activity) {
    const milestones = await this.getMilestonesByChallengeId(challengeId);
    
    for (const milestone of milestones) {
      if (milestone.isCompleted) continue;
      
      let progress = 0;
      
      switch (milestone.type) {
        case 'points':
          // Get all user activities for this challenge
          const userActivities = await Activity.find({
            challengeId,
            userId,
          });
          progress = userActivities.reduce((total, act) => total + (act.points || 0), 0);
          break;
          
        case 'activities':
          const activityCount = await Activity.countDocuments({
            challengeId,
            userId,
          });
          progress = activityCount;
          break;
          
        case 'streak':
          const allActivities = await Activity.find({
            challengeId,
            userId,
          }).sort({ date: 1 });
          progress = this.calculateStreak(allActivities);
          break;
      }
      
      if (progress > milestone.currentProgress) {
        await this.updateMilestoneProgress(milestone._id, userId, progress);
      }
    }
  },
};

export default milestoneService;