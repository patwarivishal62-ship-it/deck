const webpush = require("web-push");
const pushSubscriptionsDb = require("../db/pushSubscriptions");

let initialized = false;

function init() {
  if (initialized) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:support@planyourdeck.com";

  if (!publicKey || !privateKey) {
    console.warn("⚠️ VAPID keys not set — push notifications will be in-app only. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to enable real mobile push.");
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    initialized = true;
    console.log("✅ Web Push initialized with VAPID");
    return true;
  } catch (err) {
    console.error("Failed to init web-push:", err.message);
    return false;
  }
}

// Initialize on load (if env present)
init();

function canSendPush() {
  return initialized || init();
}

async function sendToSubscription(subscription, payload) {
  if (!canSendPush()) return false;
  try {
    // subscription from DB: { endpoint, keys: { p256dh, auth } }
    const pushSub = {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    };
    await webpush.sendNotification(pushSub, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.error(`Push failed for ${subscription.endpoint?.slice(0, 40)}:`, err.message, err.statusCode);
    // If subscription is invalid (410 Gone, 404), remove it
    if (err.statusCode === 410 || err.statusCode === 404) {
      try {
        await pushSubscriptionsDb.removeByEndpoint(subscription.userId, subscription.endpoint);
        console.log(`🗑️ Removed invalid push subscription for user ${subscription.userId}`);
      } catch {}
    }
    return false;
  }
}

async function sendPushToUser(userId, payload) {
  if (!canSendPush()) return 0;
  try {
    const subs = await pushSubscriptionsDb.listForUser(userId);
    if (subs.length === 0) return 0;

    let sent = 0;
    for (const sub of subs) {
      const ok = await sendToSubscription(sub, payload);
      if (ok) sent++;
    }
    return sent;
  } catch (err) {
    console.error("sendPushToUser error:", err);
    return 0;
  }
}

async function sendPushToMany(userIds, payload) {
  if (!canSendPush()) return 0;
  let total = 0;
  for (const uid of userIds) {
    total += await sendPushToUser(uid, payload);
  }
  return total;
}

function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

module.exports = {
  init,
  canSendPush,
  sendToSubscription,
  sendPushToUser,
  sendPushToMany,
  getVapidPublicKey,
};
