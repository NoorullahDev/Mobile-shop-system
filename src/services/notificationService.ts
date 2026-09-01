import { invoke } from "@tauri-apps/api/core";
import type {
  AppNotification,
  CreateNotificationInput,
  NotificationCount,
} from "../types/notification";

export async function listNotifications(
  unreadOnly?: boolean,
  limit?: number,
): Promise<AppNotification[]> {
  return invoke<AppNotification[]>("list_notifications", {
    unreadOnly: unreadOnly ?? false,
    limit: limit ?? 50,
  });
}

export async function getNotificationCount(): Promise<number> {
  const c = await invoke<NotificationCount>("get_notification_count");
  return c.unread;
}

export async function createNotification(input: CreateNotificationInput): Promise<AppNotification> {
  return invoke<AppNotification>("create_notification", { input });
}

export async function markNotificationRead(id: number): Promise<void> {
  return invoke<void>("mark_notification_read", { id });
}

export async function markAllNotificationsRead(): Promise<number> {
  return invoke<number>("mark_all_notifications_read");
}

export async function deleteNotification(id: number): Promise<void> {
  return invoke<void>("delete_notification", { id });
}

export async function clearReadNotifications(): Promise<number> {
  return invoke<number>("clear_read_notifications");
}