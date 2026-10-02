import { RoleCode, PermissionCode } from './database';

export interface SessionUser {
  id: string;
  email: string;
  full_name: string;
  role: RoleCode;
  permissions: PermissionCode[];
  department?: string;
  must_change_password?: boolean;
  session_version?: number;
  mfa_enabled?: boolean;
}

export interface AuthResponse {
  success: boolean;
  user?: SessionUser;
  token?: string;
  error?: string;
  requiresMfa?: boolean;
  challengeId?: string;
  email?: string;
}
