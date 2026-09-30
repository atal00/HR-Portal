import { RoleCode, PermissionCode, User } from './database';

export interface SessionUser {
  id: string;
  email: string;
  full_name: string;
  role: RoleCode;
  permissions: PermissionCode[];
}

export interface AuthResponse {
  success: boolean;
  user?: SessionUser;
  token?: string;
  error?: string;
}
