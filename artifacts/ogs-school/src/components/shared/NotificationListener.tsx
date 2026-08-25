import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../lib/notifications';

export default function NotificationListener() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    notificationService.requestPermission();
  }, [user]);

  return null;
}
