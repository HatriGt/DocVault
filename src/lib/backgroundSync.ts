/**
 * OS-scheduled background sync (WorkManager on Android, BGTaskScheduler on
 * iOS). The OS decides exact timing; minimum interval is ~15 minutes.
 * Must be imported at module scope (root layout) so the task is defined
 * before the OS wakes the app.
 */
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { syncNow } from './sync';

export const SYNC_TASK = 'docvault-background-sync';

TaskManager.defineTask(SYNC_TASK, async () => {
  try {
    await syncNow();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundSync() {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (!(await TaskManager.isTaskRegisteredAsync(SYNC_TASK))) {
      await BackgroundTask.registerTaskAsync(SYNC_TASK, { minimumInterval: 30 });
    }
  } catch {
    // Not available in Expo Go / simulators without background modes.
  }
}

export async function unregisterBackgroundSync() {
  try {
    if (await TaskManager.isTaskRegisteredAsync(SYNC_TASK)) await BackgroundTask.unregisterTaskAsync(SYNC_TASK);
  } catch {}
}
