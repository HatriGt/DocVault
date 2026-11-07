import * as Notifications from 'expo-notifications';
import type { DocRecord } from './db';
import { EXPIRING_TYPES } from './categories';

const LEAD_DAYS = [90, 30, 7];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensurePermission() {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

export async function cancelReminders(docId: string) {
  await Promise.all(
    LEAD_DAYS.map((d) => Notifications.cancelScheduledNotificationAsync(`exp:${docId}:${d}`).catch(() => {})),
  );
}

/** Schedules local reminders. Content never includes document numbers. */
export async function scheduleReminders(doc: Pick<DocRecord, 'id' | 'name' | 'expiry' | 'doc_type'>) {
  await cancelReminders(doc.id);
  if (!doc.expiry) return;
  if (doc.doc_type && !EXPIRING_TYPES.has(doc.doc_type) && !doc.expiry) return;
  if (!(await ensurePermission())) return;
  const expiry = new Date(`${doc.expiry}T09:00:00`);
  for (const days of LEAD_DAYS) {
    const at = new Date(expiry.getTime() - days * 86_400_000);
    if (at.getTime() <= Date.now()) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: `exp:${doc.id}:${days}`,
      content: {
        title: `${doc.name} expires in ${days} days`,
        body: 'Renew early to avoid travel or service disruptions.',
        data: { docId: doc.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
  }
}

export async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
