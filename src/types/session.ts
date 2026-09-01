export interface SessionUser {
  id: number;
  username: string;
  role: string;
  permissions: string[];
  login_time: string;
  default_password: boolean;
}
