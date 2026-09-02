import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { apiUrl } from '../lib/apiUrl';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

export function usePushSubscription(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    if (!('serviceWorker' in navigator)) return;
    if (!('PushManager' in window)) return;

    let cancelled = false;

    async function setupPush() {
      try {
        const res = await fetch(apiUrl('/api/push/vapid-key'));
        if (!res.ok || cancelled) return;
        const { publicKey } = await res.json();
        if (!publicKey || cancelled) return;

        const registration = await navigator.serviceWorker.ready;
        if (cancelled) return;

        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted' || cancelled) return;

          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
        }

        if (cancelled) return;

        await supabase.from('push_subscriptions').upsert(
          {
            user_id: userId,
            subscription: subscription.toJSON(),
            user_agent: navigator.userAgent.slice(0, 512),
          },
          { onConflict: 'user_id' }
        );
      } catch {
        // Push is optional — fail silently
      }
    }

    setupPush();
    return () => { cancelled = true; };
  }, [userId]);
}

export async function sendWebPush(
  userIds: string[],
  title: string,
  message: string,
  url = '/'
): Promise<void> {
  try {
    const { data } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .in('user_id', userIds);

    if (!data?.length) return;

    const subscriptions = data.map((r) => r.subscription);

    await fetch(apiUrl('/api/push/send'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptions, title, message, url }),
    });
  } catch {
    // Silent fail — push is best-effort
  }
}
