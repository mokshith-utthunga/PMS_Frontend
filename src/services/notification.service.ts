// Notification Service - Notification API calls
import { api } from './api';
import type { Notification, NotificationType } from '@/types';

export interface CreateNotificationData {
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  link?: string;
  is_read?: boolean;
}

export const notificationService = {
  // Get notifications for user
  getByUser: (userId: string, unreadOnly = false) => {
    let url = `/api/notifications?user_id=${userId}`;
    if (unreadOnly) url += '&is_read=false';
    return api.get<{ data: Notification[] }>(url);
  },

  // Create notification
  create: async (data: CreateNotificationData) => {
    try {
      return await api.post<{ data: Notification }>(
        '/api/notifications',
        { ...data, is_read: data.is_read ?? false }
      );
    } catch (error) {
      // Silently fail for notifications - non-critical
      console.error('Failed to create notification:', error);
      return null;
    }
  },

  // Mark as read
  markAsRead: (id: string) => 
    api.put(`/api/notifications/${id}`, { is_read: true }),

  // Mark all as read
  markAllAsRead: (userId: string) => 
    api.put(`/api/notifications/mark-all-read`, { user_id: userId }),

  // Delete notification
  delete: (id: string) => 
    api.delete(`/api/notifications/${id}`),
};

// Helper to send goal approval notification
export async function notifyGoalApproval(
  userId: string,
  employeeName: string,
  link: string
): Promise<void> {
  await notificationService.create({
    user_id: userId,
    title: 'Goals Submitted for Approval',
    message: `${employeeName} has submitted their goals for your approval.`,
    type: 'goal_approval',
    link,
  });
}

// Helper to send goal approved notification
export async function notifyGoalApproved(
  userId: string,
  kraTitle: string
): Promise<void> {
  await notificationService.create({
    user_id: userId,
    title: 'KRA Approved',
    message: `Your KRA "${kraTitle}" and its KPIs have been approved by your manager.`,
    type: 'goal_approval',
    link: '/goals',
  });
}

// Helper to send goal returned notification
export async function notifyGoalReturned(
  userId: string,
  itemType: string,
  itemTitle: string,
  feedback: string
): Promise<void> {
  await notificationService.create({
    user_id: userId,
    title: `${itemType} Returned`,
    message: `Your ${itemType} "${itemTitle}" has been returned. Feedback: ${feedback}`,
    type: 'goal_returned',
    link: '/goals',
  });
}
