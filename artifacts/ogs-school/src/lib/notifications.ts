import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface NotificationPayload {
  title: string;
  body: string;
  id?: string;
  data?: any;
}

class NotificationService {
  private platform = Capacitor.getPlatform();
  private hasPermission = false;

  constructor() {}

  async requestPermission(): Promise<boolean> {
    if (this.platform === 'web') {
      if (!('Notification' in window)) {
        return false;
      }

      if (Notification.permission === 'granted') {
        this.hasPermission = true;
        return true;
      }

      if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        this.hasPermission = permission === 'granted';
        return this.hasPermission;
      }
    } else {
      // Capacitor (Android/iOS)
      try {
        const status = await LocalNotifications.requestPermissions();
        this.hasPermission = status.display === 'granted';
        return this.hasPermission;
      } catch (error) {
        console.error('[NotificationService] Error requesting Capacitor notification permissions:', error);
        return false;
      }
    }

    return false;
  }

  async showNotification(payload: NotificationPayload) {
    // If not manually checked yet, check current permission status
    if (!this.hasPermission) {
      if (this.platform === 'web') {
        this.hasPermission = Notification.permission === 'granted';
      } else {
        const status = await LocalNotifications.checkPermissions();
        this.hasPermission = status.display === 'granted';
      }
    }

    if (!this.hasPermission) {
      return;
    }

    try {
      if (this.platform === 'web') {
        new Notification(payload.title, {
          body: payload.body,
          icon: '/default-logo.png',
          data: payload.data,
        });
      } else {
        await LocalNotifications.schedule({
          notifications: [
            {
              title: payload.title,
              body: payload.body,
              id: Math.floor(Math.random() * 1000000),
              extra: payload.data,
              smallIcon: 'ic_stat_name',
            },
          ],
        });
      }
    } catch (err) {
      console.error('[NotificationService] Error triggering native notification:', err);
    }
  }
}

export const notificationService = new NotificationService();
