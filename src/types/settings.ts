export interface Setting {
  id: number;
  key: string;
  value: string | null;
}

export interface ActivityLog {
  id: number;
  user_id: number | null;
  module: string;
  action: string;
  record_id: number | null;
  timestamp: string;
}
