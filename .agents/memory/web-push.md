---
name: Web Push architecture
description: How Web Push notifications are wired in the OGS school app
---

# Web Push Architecture

## Components
- **Service worker**: `artifacts/ogs-school/public/sw.js` — handles `push` event, shows OS notification; handles `notificationclick` to focus tab.
- **Client hook**: `artifacts/ogs-school/src/hooks/usePushSubscription.ts` — exports `usePushSubscription(userId)` (registers SW, subscribes, stores in Supabase) and `sendWebPush(userIds, title, message, url)` (reads subscriptions, calls API).
- **API routes**: `artifacts/api-server/src/routes/push.ts` — `GET /api/push/vapid-key`, `POST /api/push/send`. Reads VAPID keys from env vars.
- **VAPID keys**: stored as env vars `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

## Database
Requires `push_subscriptions` table in Supabase (one row per user, `user_id UNIQUE`):
```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  subscription jsonb NOT NULL,
  user_agent text,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own push subscription" ON push_subscriptions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can read push subscriptions" ON push_subscriptions FOR SELECT USING (auth.role() = 'authenticated');
```

## Proxy
Vite config already proxies `/api` → `http://localhost:8080` (the api-server). Push endpoints are at `/api/push/vapid-key` and `/api/push/send`.

## Notification flows
- Tab open: Supabase Realtime INSERT → `showPush()` in Header.tsx → in-app toast + `new Notification()`
- Tab closed: `sendWebPush()` in Requisition.tsx → api-server → browser push service → service worker → OS notification

**Why:** Browser Notification API only works with tab open. True background delivery requires a VAPID push server and service worker.

**How to apply:** Any new feature sending notifications should also call `sendWebPush()` for background delivery.
