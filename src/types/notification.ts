export type NotificationKind =
  | "general"
  | "member"
  | "finance"
  | "system"
  | "security";

export type NotificationPriority =
  | "low"
  | "normal"
  | "high"
  | "critical";

export interface AppNotification {
  id: number;
  user_id: number;
  title: string;
  message: string | null;
  kind: NotificationKind;
  priority: NotificationPriority;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface CreateNotificationInput {
  title: string;
  message?: string | null;
  kind?: NotificationKind;
  priority?: NotificationPriority;
}

export interface NotificationCount {
  unread: number;
}

export function parseTimestamp(input: string | null): Date {
  if (!input) return new Date(NaN);
  return new Date(input.replace(" ", "T") + "Z");
}