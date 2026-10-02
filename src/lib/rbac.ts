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
    'user.delete',
    'employee.delete',
    'settings.update',
    'certificate.request',
    'certificate.approve',
    'task.view',
    'task.create',
    'task.update',
    'task.assign',
    'task.delete',
  ],

  HR_ADMIN: [
    'employee.view',
    'employee.create',
    'employee.update',
    'certificate.request',
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
    'task.view',
    'task.create',
    'task.update',
    'task.assign',
  ],

  DOCUMENT_ADMIN: [
    'employee.view',
    'certificate.request',
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
    'task.view',
    'task.create',
    'task.update',
  ],

  PAYROLL_ADMIN: [
    'employee.view',
    'certificate.request',
    'salary.view',
    'salary.update',
    'document.salary.create',
    'document.salary.view',
    'document.salary.download',
    'task.view',
    'task.create',
    'task.update',
  ],

  VIEWER: [
    'employee.view',
    'certificate.request',
    'document.offer.view',
    'document.experience.view',
    'document.relieving.view',
    'document.certificate.view',
    'task.view',
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

export const PERMISSION_DESCRIPTIONS: Record<PermissionCode, string> = {
  'employee.view': 'View employee personnel records and profiles',
  'employee.create': 'Onboard new employees and candidate records',
  'employee.update': 'Edit employee demographic and employment information',
  'employee.delete': 'Submit requests to archive or delete employee records',
  'document.offer.create': 'Generate employment offer letters and revision drafts',
  'document.offer.view': 'Inspect and review generated offer letters',
  'document.offer.download': 'Download finalized offer letter PDFs',
  'document.offer.approve': 'Formally approve and sign official offer letters',
  'document.experience.create': 'Generate experience and service certificates',
  'document.experience.view': 'Inspect and preview experience certificates',
  'document.experience.download': 'Download finalized experience certificate PDFs',
  'document.experience.approve': 'Formally approve and sign experience certificates',
  'document.relieving.create': 'Generate separation and relieving orders',
  'document.relieving.view': 'Inspect and preview relieving orders',
  'document.relieving.download': 'Download finalized relieving order PDFs',
  'document.relieving.approve': 'Formally approve and sign relieving orders',
  'document.salary.create': 'Generate monthly employee salary slips',
  'document.salary.view': 'Inspect and preview salary slips',
  'document.salary.download': 'Download finalized salary slip PDFs',
  'document.salary.approve': 'Formally approve and disburse salary slips',
  'document.certificate.create': 'Generate official accomplishment and service certificates',
  'document.certificate.view': 'Inspect and preview issued certificates',
  'document.certificate.download': 'Download finalized certificate PDFs',
  'document.certificate.approve': 'Formally approve and seal issued certificates',
  'document.approve': 'Execute formal management approval on documents',
  'document.reject': 'Reject document drafts with mandatory reason',
  'document.revoke': 'Formally revoke previously approved documents',
  'template.create': 'Create new document templates and blueprints',
  'template.update': 'Modify existing document layout and template versions',
  'template.publish': 'Publish document templates to production registry',
  'salary.view': 'Inspect confidential employee compensation structures',
  'salary.update': 'Update confidential employee salary and CTC packages',
  'user.create': 'Create and invite new authorized system users',
  'user.update': 'Modify user roles, departments, and active statuses',
  'user.delete': 'Delete user accounts under controlled audit governance',
  'role.assign': 'Assign and alter security roles for system personnel',
  'permission.assign': 'Manage granular explicit permission overrides',
  'audit.view': 'Access the immutable system-wide security audit registry',
  'security.view': 'Inspect security violation logs and breach attempts',
  'settings.update': 'Update system branding, corporate metadata, and seals',
  'certificate.request': 'Submit formal requests for certificate issuance access',
  'certificate.approve': 'Approve or reject certificate issuance access requests',
  'task.view': 'View operational workflow tasks and checklists',
  'task.create': 'Create and assign new HR operational tasks',
  'task.update': 'Update task statuses and execution details',
  'task.assign': 'Reassign operational tasks across authorized users',
  'task.delete': 'Remove or archive operational workflow tasks',
};

/**
 * Server-side RBAC permission evaluator
 */
export function hasPermission(user: SessionUser | null | undefined, permission: PermissionCode): boolean {
  if (!user) return false;
  const effectiveUser: SessionUser = (user as any)?.user || user;
  if (effectiveUser.role === 'SUPER_ADMIN') return true;
  if (!Array.isArray(effectiveUser.permissions)) return false;
  return effectiveUser.permissions.includes(permission);
}

export function hasAnyPermission(user: SessionUser | null | undefined, permissions: PermissionCode[]): boolean {
  if (!user) return false;
  const effectiveUser: SessionUser = (user as any)?.user || user;
  if (effectiveUser.role === 'SUPER_ADMIN') return true;
  if (!Array.isArray(effectiveUser.permissions)) return false;
  return permissions.some((p) => effectiveUser.permissions.includes(p));
}

export function hasAllPermissions(user: SessionUser | null | undefined, permissions: PermissionCode[]): boolean {
  if (!user) return false;
  const effectiveUser: SessionUser = (user as any)?.user || user;
  if (effectiveUser.role === 'SUPER_ADMIN') return true;
  if (!Array.isArray(effectiveUser.permissions)) return false;
  return permissions.every((p) => effectiveUser.permissions.includes(p));
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
