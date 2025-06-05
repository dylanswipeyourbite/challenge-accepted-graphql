// File: src/services/notificationService.js

import { notificationModel } from '../models/Notification.js';
import admin from 'firebase-admin';

export const notificationService = {
  async scheduleChallengeReminders(challenge) {
    // Schedule daily reminders for all participants
    for (const participant of challenge.participants) {
      if (participant.status === 'accepted') {
        await this.scheduleUserReminders(
          participant.user,
          challenge._id,
          challenge.title
        );
      }
    }
  },
  
  async scheduleUserReminders(userId, challengeId, challengeTitle) {
    const user = await userModel.findById(userId);
    if (!user.notificationSettings?.enableDailyReminders) return;
    
    const reminderTime = user.notificationSettings.reminderTime || '08:00';
    const [hour, minute] = reminderTime.split(':').map(Number);
    
    // Create morning reminder
    await notificationModel.create({
      userId,
      type: 'reminder',
      title: 'Good morning, Champion! 🌅',
      body: `Time to log your activity for ${challengeTitle}`,
      data: { challengeId },
      scheduledFor: this.getNextScheduledTime(hour, minute)
    });
    
    // Create evening reminder
    await notificationModel.create({
      userId,
      type: 'reminder',
      title: 'Don\'t break your streak! 🔥',
      body: `Have you logged your ${challengeTitle} activity today?`,
      data: { challengeId },
      scheduledFor: this.getNextScheduledTime(19, 0)
    });
  },
  
  async sendChallengeInvite(userId, challengeTitle, inviterId) {
    const inviter = await userModel.findById(inviterId);
    
    const notification = await notificationModel.create({
      userId,
      type: 'challenge_invite',
      title: 'New Challenge Invite! 🎯',
      body: `${inviter.displayName} invited you to join "${challengeTitle}"`,
      data: { challengeTitle, inviterId }
    });
    
    // Send push notification
    await this.sendPushNotification(userId, notification);
  },
  
  async notifyNewMilestone(challenge, milestone) {
    const notifications = [];
    
    for (const participant of challenge.participants) {
      if (participant.status === 'accepted') {
        notifications.push({
          userId: participant.user,
          type: 'milestone',
          title: 'New Milestone Added! 🎯',
          body: `"${milestone.title}" - Can you achieve it?`,
          data: {
            challengeId: challenge._id,
            milestoneId: milestone.id
          }
        });
      }
    }
    
    await notificationModel.insertMany(notifications);
    
    // Send push notifications
    for (const notif of notifications) {
      await this.sendPushNotification(notif.userId, notif);
    }
  },
  
  async notifyChatMessage(challenge, message, senderId) {
    const sender = await userModel.findById(senderId);
    
    for (const participant of challenge.participants) {
      if (participant.user.toString() !== senderId.toString() &&
          participant.status === 'accepted') {
        
        const user = await userModel.findById(participant.user);
        if (!user.notificationSettings?.enableSocialNotifications) continue;
        
        const notification = await notificationModel.create({
          userId: participant.user,
          type: 'social',
          title: `${sender.displayName} in ${challenge.title}`,
          body: message.text.substring(0, 100),
          data: {
            challengeId: challenge._id,
            messageId: message._id
          }
        });
        
        await this.sendPushNotification(participant.user, notification);
      }
    }
  },
  
  async notifyMilestoneAchieved(userId, milestone, challenge) {
    const user = await userModel.findById(userId);
    
    const notification = await notificationModel.create({
      userId,
      type: 'achievement',
      title: 'Milestone Achieved! 🎯',
      body: `You unlocked "${milestone.title}" in ${challenge.title}!`,
      data: {
        challengeId: challenge._id,
        milestoneId: milestone.id
      }
    });
    
    await this.sendPushNotification(userId, notification);
    
    // Notify other participants
    for (const participant of challenge.participants) {
      if (participant.user.toString() !== userId.toString() &&
          participant.status === 'accepted') {
        
        await notificationModel.create({
          userId: participant.user,
          type: 'social',
          title: 'Teammate Achievement! 🎉',
          body: `${user.displayName} achieved "${milestone.title}"!`,
          data: {
            challengeId: challenge._id,
            milestoneId: milestone.id,
            achieverId: userId
          }
        });
      }
    }
  },
  
  async sendPushNotification(userId, notification) {
    const user = await userModel.findById(userId);
    if (!user.fcmToken) return;
    
    try {
      await admin.messaging().send({
        token: user.fcmToken,
        notification: {
          title: notification.title,
          body: notification.body
        },
        data: notification.data,
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      });
      
      notification.sentAt = new Date();
      await notification.save();
    } catch (error) {
      console.error('Push notification failed:', error);
    }
  },
  
  getNextScheduledTime(hour, minute) {
    const now = new Date();
    const scheduled = new Date();
    scheduled.setHours(hour, minute, 0, 0);
    
    if (scheduled <= now) {
      scheduled.setDate(scheduled.getDate() + 1);
    }
    
    return scheduled;
  }
};