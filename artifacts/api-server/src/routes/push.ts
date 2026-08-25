import { Router } from "express";
import webpush from "web-push";

const router = Router();

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT ?? "mailto:admin@okrikagrammarschool.org";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

router.get("/push/vapid-key", (_req, res) => {
  if (!VAPID_PUBLIC_KEY) {
    res.status(503).json({ error: "Push not configured" });
    return;
  }
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

router.post("/push/send", async (req, res) => {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    res.status(503).json({ error: "Push not configured" });
    return;
  }

  const { subscriptions, title, message, url } = req.body as {
    subscriptions: webpush.PushSubscription[];
    title: string;
    message?: string;
    url?: string;
  };

  if (!Array.isArray(subscriptions) || !subscriptions.length || !title) {
    res.status(400).json({ error: "subscriptions[] and title are required" });
    return;
  }

  const payload = JSON.stringify({
    title,
    message: message ?? "",
    url: url ?? "/",
  });

  const results = await Promise.allSettled(
    subscriptions.map((sub) => webpush.sendNotification(sub, payload))
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  res.json({ sent: results.length - failed, failed });
});

export default router;
