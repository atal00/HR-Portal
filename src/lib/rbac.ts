import { RoleCode, PermissionCode } from '@/types/database';
import { SessionUser } from '@/types/auth';

export const ROLE_PERMISSIONS: Record<RoleCode, PermissionCode[]> = {
  SUPER_ADMIN: [
    'employee.view',
    'employee.create',
    'employee.update',
    'document.offer.create',
    'document.offer.view',
    'document.offer.download',
    'document.offer.approve',
    'document.experience.create',
    'document.experience.view',
    'document.experience.download',
    'document.experience.approve',
    'document.relieving.create',
    'document.relieving.view',
    'document.relieving.download',
    'document.relieving.approve',
    'document.salary.create',
    'document.salary.view',
    'document.salary.download',
    'document.salary.approve',
    'document.certificate.create',
    'document.certificate.view',
    'document.certificate.download',
    'document.certificate.approve',
    'document.approve',
    'document.reject',
    'document.revoke',
    'template.create',
    'template.update',
    'template.publish',
    'salary.view',
    'salary.update',
    'user.create',
    'user.update',
    'role.assign',
    'permission.assign',
    'audit.view',
    'security.view',
  ],

  HR_ADMIN: [
    'employee.view',
    'employee.create',
    'employee.update',
    'document.offer.create',
    'document.offer.view',
    'document.offer.download',
    'document.offer.approve',
    'document.experience.create',
    'document.experience.view',
    'document.experience.download',
    'document.experience.approve',
    'document.relieving.create',
    'document.relieving.view',
    'document.relieving.download',
    'document.relieving.approve',
    'document.certificate.create',
    'document.certificate.view',
    'document.certificate.download',
    'document.certificate.approve',
    'document.approve',
    'document.reject',
    'document.revoke',
  ],

  DOCUMENT_ADMIN: [
    'employee.view',
    'document.offer.create',
    'document.offer.view',
    'document.offer.download',
    'document.offer.approve',
    'document.experience.create',
    'document.experience.view',
    'document.experience.download',
    'document.experience.approve',
    'document.relieving.create',
    'document.relieving.view',
    'document.relieving.download',
    'document.relieving.approve',
    'document.certificate.create',
    'document.certificate.view',
    'document.certificate.download',
    'document.certificate.approve',
    'document.approve',
    'document.reject',
    'template.create',
    'template.update',
    'template.publish',
  ],

  PAYROLL_ADMIN: [
    'employee.view',
    'salary.view',
    'salary.update',
    'document.salary.create',
    'document.salary.view',
    'document.salary.download',
    'document.salary.approve',
  ],

  VIEWER: [
    'employee.view',
    'document.offer.view',
    'document.experience.view',
    'document.relieving.view',
    'document.certificate.view',
  ],
};

export const ROLE_LABELS: Record<RoleCode, { name: string; description: string; badgeColor: string }> = {
  SUPER_ADMIN: {
    name: 'Super Administrator',
    description: 'Unrestricted full system and security authority',
    badgeColor: 'bg-red-100 text-red-800 border-red-200',
  },
  HR_ADMIN: {
    name: 'HR Administrator',
    description: 'Manages employees, offers, experience, and relieving letters',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  DOCUMENT_ADMIN: {
    name: 'Document Administrator',
    description: 'Manages document templates, versions, and certificates',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
  PAYROLL_ADMIN: {
    name: 'Payroll Administrator',
    description: 'Exclusively manages employee CTC, compensation, and salary slips',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  VIEWER: {
    name: 'Auditor / Viewer',
    description: 'Read-only access to authorized records without generation or modification rights',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
  },
};

/**
 * Server-side RBAC permission evaluator
 */
export function hasPermission(user: SessionUser | null | undefined, permission: PermissionCode): boolean {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  return user.permissions.includes(permission);
}

export function hasAnyPermission(user: SessionUser | null | undefined, permissions: PermissionCode[]): boolean {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  return permissions.some((p) => user.permissions.includes(p));
}

export function hasAllPermissions(user: SessionUser | null | undefined, permissions: PermissionCode[]): boolean {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  return permissions.every((p) => user.permissions.includes(p));
}

export function canAccessSalary(user: SessionUser | null | undefined): boolean {
  return hasPermission(user, 'salary.view');
}

export function canModifySalary(user: SessionUser | null | undefined): boolean {
  return hasPermission(user, 'salary.update');
}

export function canRevokeDocument(user: SessionUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  return hasPermission(user, 'document.revoke');
}

export function canApproveDocument(user: SessionUser | null | undefined, documentType?: string): boolean {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  if (hasPermission(user, 'document.approve')) return true;
  if (documentType) {
    const specificPerm = `document.${documentType.toLowerCase().split('_')[0]}.approve` as PermissionCode;
    return hasPermission(user, specificPerm);
  }
  return false;
}
