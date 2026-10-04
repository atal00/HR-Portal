import crypto from 'crypto';
import { localDb } from './storage/mock-db';
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
  isProductionEnv
} from './supabase';
import {
  Employee,
  EmployeeSalary,
  DocumentRecord,
  DocumentType,
  DocumentWorkflowStatus,
  User,
  Department,
  TemplateRecord,
  AuditLog,
  SecurityLog,
  PublicVerificationResult,
  PublicVerificationStatus,
  RoleCode,
  PermissionCode,
  TaskRecord,
  TaskPriority,
  TaskStatus,
  UserPermissionOverride,
  CorporateMetadata,
  CertificateAccessRequest,
  UserCredential,
  UserMfa
} from '@/types/database';
import { ROLE_PERMISSIONS, PERMISSION_DESCRIPTIONS } from './rbac';
import { logAuditEvent, logSecurityEvent } from './audit';
import {
  generateVerificationId,
  formatDocumentNumber,
  formatEmployeeId,
  parseEmployeeIdSequence
} from './id-generator';
import {
  generateSecureTemporaryPassword,
  hashPassword,
  verifyPassword,
  validatePasswordPolicy
} from './password';


/**
 * DatabaseError represents an internal datastore error.
 * Preserves detailed server-side diagnostics in server logs without exposing
 * sensitive schema details (table names, constraints, column names) to API clients.
 */
export class DatabaseError extends Error {
  public readonly isDatabaseError = true;
  public readonly context: string;
  public readonly originalMessage: string;

  constructor(context: string, error?: any) {
    const rawMsg = error?.message || String(error || 'Internal datastore error');
    // Server-side diagnostic log (never includes passwords or tokens)
    console.error(`[DATABASE ERROR] (${context}):`, rawMsg);

    const isProd = isProductionEnv();
    const clientMessage = isProd
      ? 'Unable to complete the requested operation.'
      : `Supabase error (${context}): ${rawMsg}`;

    super(clientMessage);
    this.name = 'DatabaseError';
    this.context = context;
    this.originalMessage = rawMsg;
  }
}

export function handleDbError(context: string, error: any): never {
  throw new DatabaseError(context, error);
}

function isSupabaseMode(): boolean {
  if (process.env.STORAGE_MODE === 'mock') {
    if (isProductionEnv()) {
      throw new Error(
        'FATAL DATA INTEGRITY VIOLATION: Mock datastore mode is strictly prohibited in production environments.'
      );
    }
    return false;
  }
  return (
    process.env.STORAGE_MODE === 'supabase' ||
    process.env.NODE_ENV === 'production' ||
    isSupabaseConfigured()
  );
}

function isUuid(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function assertDatastoreMode() {
  if (isProductionEnv() && !isSupabaseConfigured()) {
    throw new Error(
      'FATAL PRODUCTION SECURITY ERROR: Production deployment requires connected Supabase PostgreSQL instance. Silent fallback to local storage is blocked.'
    );
  }
}

// ---------------------------------------------------------------------------
// Supabase Row Mappers
// ---------------------------------------------------------------------------

function mapSupabaseUser(row: any): User {
  const roles = (row.user_roles || []).map((ur: any) => ur.roles).filter(Boolean);
  const primaryRole: RoleCode = (roles[0]?.code as RoleCode) || 'VIEWER';

  const permissionsSet = new Set<PermissionCode>();
  for (const r of roles) {
    if (ROLE_PERMISSIONS[r.code as RoleCode]) {
      ROLE_PERMISSIONS[r.code as RoleCode].forEach((p) => permissionsSet.add(p));
    }
    if (r.role_permissions) {
      for (const rp of r.role_permissions) {
        if (rp.permissions?.code) {
          permissionsSet.add(rp.permissions.code as PermissionCode);
        }
      }
    }
  }

  if (permissionsSet.size === 0 && ROLE_PERMISSIONS[primaryRole]) {
    ROLE_PERMISSIONS[primaryRole].forEach((p) => permissionsSet.add(p));
  }

  return {
    id: row.id,
    auth_user_id: row.auth_user_id || undefined,
    email: row.email,
    full_name: row.full_name,
    avatar_url: row.avatar_url || undefined,
    is_active: row.is_active ?? true,
    role: primaryRole,
    permissions: Array.from(permissionsSet),
    department: row.department || undefined,
    department_id: row.department_id || undefined,
    deactivation_reason: row.deactivation_reason || undefined,
    deletion_status: row.deletion_status || 'NONE',
    deletion_reason: row.deletion_reason || undefined,
    must_change_password: row.must_change_password ?? false,
    temp_password_expires_at: row.temp_password_expires_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapSupabaseDepartment(row: any): Department {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description || undefined,
    created_at: row.created_at,
  };
}

function mapSupabaseEmployee(row: any): Employee {
  const deptName = row.departments?.name || undefined;
  return {
    id: row.id,
    employee_id: row.employee_id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    department_id: row.department_id,
    department_name: deptName,
    department: deptName,
    designation: row.designation,
    joining_date: row.joining_date,
    last_working_date: row.last_working_date || null,
    employment_type: row.employment_type as any,
    work_location: row.work_location,
    reporting_manager: row.reporting_manager || undefined,
    status: row.status as any,
    deletion_status: row.deletion_status || 'NONE',
    deletion_reason: row.deletion_reason || undefined,
    deletion_requested_by: row.deletion_requested_by || undefined,
    deletion_requested_at: row.deletion_requested_at || undefined,
    deletion_approved_by: row.deletion_approved_by || undefined,
    deletion_approved_at: row.deletion_approved_at || undefined,
    is_system_protected: row.is_system_protected !== undefined ? Boolean(row.is_system_protected) : undefined,

    // Section A - Personal Information
    father_name: row.father_name || undefined,
    mother_name: row.mother_name || undefined,
    date_of_birth: row.date_of_birth || undefined,
    gender: row.gender || undefined,
    personal_email: row.personal_email || undefined,
    alternate_phone: row.alternate_phone || undefined,
    permanent_address: row.permanent_address || undefined,
    current_address: row.current_address || undefined,
    city: row.city || undefined,
    state: row.state || undefined,
    country: row.country || undefined,
    pin_code: row.pin_code || undefined,

    // Section B - Identity / Statutory Information
    pan_number: row.pan_number || undefined,
    aadhaar_number: row.aadhaar_number || undefined,
    passport_number: row.passport_number || undefined,
    uan: row.uan || undefined,
    pf_number: row.pf_number || undefined,
    esic_number: row.esic_number || undefined,

    // Section C - Employment Information
    probation_period: row.probation_period || undefined,
    confirmation_date: row.confirmation_date || undefined,
    notice_period: row.notice_period || undefined,
    date_of_separation: row.date_of_separation || undefined,
    separation_reason: row.separation_reason || undefined,

    // Section D - Bank & Payroll Information
    bank_name: row.bank_name || undefined,
    bank_account_holder_name: row.bank_account_holder_name || undefined,
    bank_account_number: row.bank_account_number || undefined,
    bank_ifsc: row.bank_ifsc || undefined,
    salary_structure: row.salary_structure || undefined,

    // Section E - Document / KYC References
    kyc_documents: row.kyc_documents || undefined,

    created_by: row.created_by || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapSupabaseSalary(row: any): EmployeeSalary {
  return {
    id: row.id,
    employee_id: row.employee_id,
    annual_ctc: Number(row.annual_ctc) || 0,
    monthly_gross: Number(row.monthly_gross) || 0,
    basic: Number(row.basic) || 0,
    hra: Number(row.hra) || 0,
    communication_allowance: Number(row.communication_allowance) || 0,
    travel_allowance: Number(row.travel_allowance) || 0,
    food_allowance: Number(row.food_allowance) || 0,
    other_allowances: Number(row.other_allowances) || 0,
    special_allowance: Number(row.special_allowance) || 0,
    conveyance: Number(row.conveyance) || 0,
    employee_pf: Number(row.employee_pf) || 0,
    employer_pf: Number(row.employer_pf) || 0,
    professional_tax: Number(row.professional_tax) || 0,
    gratuity: Number(row.gratuity) || 0,
    tds: Number(row.tds) || 0,
    esic: Number(row.esic) || 0,
    other_deductions: Number(row.other_deductions) || 0,
    variable_pay: Number(row.variable_pay) || 0,
    net_salary: Number(row.net_salary) || 0,
    pan_number: row.pan_number || undefined,
    bank_name: row.bank_name || undefined,
    bank_account_number: row.bank_account_number || undefined,
    pf_number: row.pf_number || undefined,
    effective_date: row.effective_date,
    updated_at: row.updated_at,
  };
}

function mapSupabaseDocument(row: any): DocumentRecord {
  const empName = row.employees?.full_name || row.data_snapshot?.candidateName || row.data_snapshot?.employeeName || '';
  let sanitizedTitle = row.title || '';
  if (sanitizedTitle.includes('undefined') && empName) {
    sanitizedTitle = sanitizedTitle.replace(/undefined\s*undefined/g, empName);
  }

  return {
    id: row.id,
    document_number: row.document_number,
    verification_id: row.verification_id,
    document_type: row.document_type as DocumentType,
    employee_id: row.employee_id,
    employee_name: empName || undefined,
    employee_code: row.employees?.employee_id || row.data_snapshot?.employeeCode || undefined,
    template_id: row.template_id || undefined,
    template_version: row.template_version || 'v1.0',
    title: sanitizedTitle,
    status: row.status as DocumentWorkflowStatus,
    issue_date: row.issue_date,
    data_snapshot: row.data_snapshot || {},
    file_path: row.file_path || undefined,
    file_size_bytes: row.file_size_bytes ? Number(row.file_size_bytes) : undefined,
    checksum_sha256: row.checksum_sha256 || undefined,
    created_by: row.created_by,
    created_by_name: row.created_by_name || undefined,
    approved_by: row.approved_by || undefined,
    approved_by_name: row.approved_by_name || undefined,
    approved_at: row.approved_at || undefined,
    revoked_by: row.revoked_by || undefined,
    revoked_by_name: row.revoked_by_name || undefined,
    revoked_at: row.revoked_at || undefined,
    revocation_reason: row.revocation_reason || undefined,
    version_number: row.version_number || 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapSupabaseTemplate(row: any): TemplateRecord {
  return {
    id: row.id,
    template_code: row.template_code,
    name: row.name,
    document_type: row.document_type as DocumentType,
    current_version: row.current_version,
    status: row.status,
    created_by: row.created_by,
    published_by: row.published_by || undefined,
    published_at: row.published_at || undefined,
    sections: row.sections || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapSupabaseTask(row: any): TaskRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description || null,
    assigned_to: row.assigned_to,
    assigned_to_name: row.assigned_user?.full_name || undefined,
    assigned_to_email: row.assigned_user?.email || undefined,
    created_by: row.created_by,
    created_by_name: row.created_user?.full_name || undefined,
    created_by_email: row.created_user?.email || undefined,
    priority: row.priority as TaskPriority,
    status: row.status as TaskStatus,
    due_date: row.due_date || null,
    employee_id: row.employee_id || null,
    employee_name: row.employee?.full_name || undefined,
    employee_code: row.employee?.employee_id || undefined,
    document_id: row.document_id || null,
    document_number: row.document?.document_number || undefined,
    document_title: row.document?.title || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getStoredTasks(): Promise<TaskRecord[]> {
  if (isSupabaseMode()) {
    try {
      const stored = await db.systemSettings.get('tasks_store');
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  }
  return localDb.getState().tasks || [];
}

async function saveStoredTasks(tasks: TaskRecord[]): Promise<void> {
  if (isSupabaseMode()) {
    await db.systemSettings.set('tasks_store', tasks, 'Internal HR document tasks datastore');
    return;
  }
  localDb.getState().tasks = tasks;
  localDb.save();
}

async function enrichTaskRecord(t: TaskRecord): Promise<TaskRecord> {
  let assignedName = t.assigned_to_name;
  let assignedEmail = t.assigned_to_email;
  let createdName = t.created_by_name;
  let createdEmail = t.created_by_email;
  let empName = t.employee_name;
  let empCode = t.employee_code;
  let docNumber = t.document_number;
  let docTitle = t.document_title;

  if (!assignedName && t.assigned_to) {
    try {
      const u = await db.users.getById(t.assigned_to);
      if (u) {
        assignedName = u.full_name;
        assignedEmail = u.email;
      }
    } catch {
      // Non-fatal lookup fallback
    }
  }

  if (!createdName && t.created_by) {
    try {
      const u = await db.users.getById(t.created_by);
      if (u) {
        createdName = u.full_name;
        createdEmail = u.email;
      }
    } catch {
      // Non-fatal lookup fallback
    }
  }

  if (!empName && t.employee_id) {
    try {
      const emp = await db.employees.getById(t.employee_id);
      if (emp) {
        empName = emp.full_name;
        empCode = emp.employee_id;
      }
    } catch {
      // Non-fatal lookup fallback
    }
  }

  if (!docNumber && t.document_id) {
    try {
      const doc = await db.documents.getById(t.document_id);
      if (doc) {
        docNumber = doc.document_number;
        docTitle = doc.title;
      }
    } catch {
      // Non-fatal lookup fallback
    }
  }

  return {
    ...t,
    assigned_to_name: assignedName,
    assigned_to_email: assignedEmail,
    created_by_name: createdName,
    created_by_email: createdEmail,
    employee_name: empName,
    employee_code: empCode,
    document_number: docNumber,
    document_title: docTitle,
  };
}

// ---------------------------------------------------------------------------
// Database Access Layer (DAL)
// ---------------------------------------------------------------------------

const localSettingsStore: Record<string, any> = {};
const inMemoryDocSeq = new Map<string, number>();

export const db = {
  users: {
    async list(): Promise<User[]> {
      assertDatastoreMode();
      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        const { data, error } = await supabase
          .from('users')
          .select(`
            id,
            auth_user_id,
            email,
            full_name,
            avatar_url,
            is_active,
            created_at,
            updated_at,
            user_roles (
              roles (
                code,
                name,
                role_permissions (
                  permissions (code)
                )
              )
            )
          `)
          .order('created_at', { ascending: true });

        if (error) handleDbError('users.list', error);

        // Check live auth.users to ensure deleted auth users are not shown
        let validAuthUserIds: Set<string> | null = null;
        let validAuthEmails: Set<string> | null = null;
        try {
          const { data: authData, error: authErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
          if (!authErr && authData?.users) {
            validAuthUserIds = new Set(authData.users.map((au) => au.id));
            validAuthEmails = new Set(authData.users.map((au) => au.email?.toLowerCase()).filter(Boolean) as string[]);
          }
        } catch {
          // If auth admin API is unavailable, continue with public.users
        }

        const validRows = (data || []).filter((row: any) => {
          // If auth user verification is active and row has an auth_user_id
          if (validAuthUserIds && validAuthEmails && row.auth_user_id) {
            const hasValidAuthId = validAuthUserIds.has(row.auth_user_id);
            const hasValidEmail = row.email && validAuthEmails.has(row.email.toLowerCase());
            // If neither auth ID nor email exists in auth.users, user was deleted in Supabase
            if (!hasValidAuthId && !hasValidEmail) {
              return false;
            }
          }
          return true;
        });

        const mappedList = validRows.map(mapSupabaseUser);

        // Batch load all user credentials and metadata in parallel (eliminating N+1 queries)
        const [credsRes, metaRes] = await Promise.all([
          supabase.from('user_credentials').select('user_id, must_change_password, temp_password_expires_at, session_version'),
          supabase.from('system_settings').select('key, value').ilike('key', 'user_meta_%'),
        ]);

        const credMap = new Map<string, any>();
        if (credsRes.data) {
          for (const c of credsRes.data) {
            credMap.set(c.user_id, c);
          }
        }

        const metaMap = new Map<string, any>();
        if (metaRes.data) {
          for (const m of metaRes.data) {
            metaMap.set(m.key, m.value);
          }
        }

        for (const userRecord of mappedList) {
          const meta = metaMap.get(`user_meta_${userRecord.id}`);
          if (meta) {
            if (meta.department && !userRecord.department) userRecord.department = meta.department;
            if (meta.deletion_status && userRecord.deletion_status === 'NONE') userRecord.deletion_status = meta.deletion_status;
            if (meta.deletion_reason) userRecord.deletion_reason = meta.deletion_reason;
          }
          const cred = credMap.get(userRecord.id);
          if (cred) {
            userRecord.must_change_password = cred.must_change_password;
            userRecord.temp_password_expires_at = cred.temp_password_expires_at;
            userRecord.session_version = cred.session_version;
          }
        }

        return mappedList.filter((u) => u.deletion_status !== 'DELETED');
      }

      if (isProductionEnv()) {
        throw new Error('FATAL: Attempted to read local mock users in production environment.');
      }
      return localDb.getState().users.filter((u) => u.deletion_status !== 'DELETED');
    },

    async getById(id: string): Promise<User | null> {
      assertDatastoreMode();
      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        let userRecord: User | null = null;

        if (isUuid(id)) {
          const { data, error } = await supabase
            .from('users')
            .select(`
              id,
              auth_user_id,
              email,
              full_name,
              avatar_url,
              is_active,
              created_at,
              updated_at,
              user_roles (
                roles (
                  code,
                  name,
                  role_permissions (
                    permissions (code)
                  )
                )
              )
            `)
            .or(`id.eq.${id},auth_user_id.eq.${id}`)
            .maybeSingle();

          if (error) handleDbError('users.getById', error);
          if (data) {
            userRecord = mapSupabaseUser(data);
          }
        } else if (id.includes('@')) {
          return await this.getByEmail(id);
        } else {
          // In production, never return mock seed users
          if (isProductionEnv()) {
            return null;
          }
          const localUser = localDb.getState().users.find((u) => u.id === id);
          if (localUser) {
            const overridesKey = `user_perm_overrides_${localUser.id}`;
            const overrides = await db.systemSettings.get<UserPermissionOverride[]>(overridesKey);
            let effectivePerms = localUser.permissions;
            if (overrides && Array.isArray(overrides)) {
              const permSet = new Set<PermissionCode>(ROLE_PERMISSIONS[localUser.role] || []);
              for (const ov of overrides) {
                if (ov.is_granted) permSet.add(ov.permission_code);
                else permSet.delete(ov.permission_code);
              }
              if (localUser.role === 'SUPER_ADMIN') {
                ROLE_PERMISSIONS.SUPER_ADMIN.forEach((p) => permSet.add(p));
              }
              effectivePerms = Array.from(permSet);
            }
            return {
              ...localUser,
              permissions: effectivePerms,
              permission_overrides: overrides || [],
            };
          }
        }

        if (userRecord) {
          const metaKey = `user_meta_${userRecord.id}`;
          const overridesKey = `user_perm_overrides_${userRecord.id}`;
          const [meta, cred, overrides] = await Promise.all([
            db.systemSettings.get<any>(metaKey),
            db.userCredentials.getByUserId(userRecord.id),
            db.systemSettings.get<UserPermissionOverride[]>(overridesKey),
          ]);
          if (meta) {
            if (meta.department && !userRecord.department) userRecord.department = meta.department;
            if (meta.deletion_status && userRecord.deletion_status === 'NONE') userRecord.deletion_status = meta.deletion_status;
            if (meta.deletion_reason) userRecord.deletion_reason = meta.deletion_reason;
          }
          if (cred) {
            userRecord.must_change_password = cred.must_change_password;
            userRecord.temp_password_expires_at = cred.temp_password_expires_at;
            userRecord.session_version = cred.session_version;
          }
          if (overrides && Array.isArray(overrides)) {
            const permSet = new Set<PermissionCode>(userRecord.permissions);
            for (const ov of overrides) {
              if (ov.is_granted) {
                permSet.add(ov.permission_code);
              } else {
                permSet.delete(ov.permission_code);
              }
            }
            if (userRecord.role === 'SUPER_ADMIN') {
              ROLE_PERMISSIONS.SUPER_ADMIN.forEach((p) => permSet.add(p));
            }
            userRecord.permissions = Array.from(permSet);
            userRecord.permission_overrides = overrides;
          }
          return userRecord;
        }
        return null;
      }

      if (isProductionEnv()) {
        throw new Error('FATAL: Attempted to read local mock users in production environment.');
      }
      const localUser = localDb.getState().users.find((u) => u.id === id);
      if (localUser) {
        const overridesKey = `user_perm_overrides_${localUser.id}`;
        const overrides = await db.systemSettings.get<UserPermissionOverride[]>(overridesKey);
        let effectivePerms = localUser.permissions;
        if (overrides && Array.isArray(overrides)) {
          const permSet = new Set<PermissionCode>(ROLE_PERMISSIONS[localUser.role] || []);
          for (const ov of overrides) {
            if (ov.is_granted) permSet.add(ov.permission_code);
            else permSet.delete(ov.permission_code);
          }
          if (localUser.role === 'SUPER_ADMIN') {
            ROLE_PERMISSIONS.SUPER_ADMIN.forEach((p) => permSet.add(p));
          }
          effectivePerms = Array.from(permSet);
        }
        return {
          ...localUser,
          permissions: effectivePerms,
          permission_overrides: overrides || [],
        };
      }
      return null;
    },

    async getByEmail(email: string): Promise<User | null> {
      const normalizedEmail = email.trim().toLowerCase();
      if (isSupabaseMode()) {
        assertDatastoreMode();
        const supabase = getSupabaseAdminClient();
        const { data, error } = await supabase
          .from('users')
          .select(`
            id,
            auth_user_id,
            email,
            full_name,
            avatar_url,
            is_active,
            created_at,
            updated_at,
            user_roles (
              roles (
                code,
                name,
                role_permissions (
                  permissions (code)
                )
              )
            )
          `)
          .ilike('email', normalizedEmail)
          .maybeSingle();

        if (error) handleDbError('users.getByEmail', error);
        if (!data) return null;
        const mapped = mapSupabaseUser(data);
        const metaKey = `user_meta_${mapped.id}`;
        const overridesKey = `user_perm_overrides_${mapped.id}`;
        const [meta, cred, overrides] = await Promise.all([
          db.systemSettings.get<any>(metaKey),
          db.userCredentials.getByUserId(mapped.id),
          db.systemSettings.get<UserPermissionOverride[]>(overridesKey),
        ]);
        if (meta) {
          if (meta.department && !mapped.department) mapped.department = meta.department;
          if (meta.deletion_status && mapped.deletion_status === 'NONE') mapped.deletion_status = meta.deletion_status;
          if (meta.deletion_reason) mapped.deletion_reason = meta.deletion_reason;
        }
        if (cred) {
          mapped.must_change_password = cred.must_change_password;
          mapped.temp_password_expires_at = cred.temp_password_expires_at;
          mapped.session_version = cred.session_version;
        }
        if (overrides && Array.isArray(overrides)) {
          const permSet = new Set<PermissionCode>(mapped.permissions);
          for (const ov of overrides) {
            if (ov.is_granted) {
              permSet.add(ov.permission_code);
            } else {
              permSet.delete(ov.permission_code);
            }
          }
          if (mapped.role === 'SUPER_ADMIN') {
            ROLE_PERMISSIONS.SUPER_ADMIN.forEach((p) => permSet.add(p));
          }
          mapped.permissions = Array.from(permSet);
          mapped.permission_overrides = overrides;
        }
        return mapped;
      }
      if (isProductionEnv()) {
        throw new Error('FATAL: Attempted to read local mock users in production environment.');
      }
      const localUser = localDb.getState().users.find((u) => u.email.toLowerCase() === normalizedEmail);
      if (localUser) {
        const overridesKey = `user_perm_overrides_${localUser.id}`;
        const overrides = await db.systemSettings.get<UserPermissionOverride[]>(overridesKey);
        let effectivePerms = localUser.permissions;
        if (overrides && Array.isArray(overrides)) {
          const permSet = new Set<PermissionCode>(ROLE_PERMISSIONS[localUser.role] || []);
          for (const ov of overrides) {
            if (ov.is_granted) permSet.add(ov.permission_code);
            else permSet.delete(ov.permission_code);
          }
          if (localUser.role === 'SUPER_ADMIN') {
            ROLE_PERMISSIONS.SUPER_ADMIN.forEach((p) => permSet.add(p));
          }
          effectivePerms = Array.from(permSet);
        }
        return {
          ...localUser,
          permissions: effectivePerms,
          permission_overrides: overrides || [],
        };
      }
      return null;
    },

    async updateStatus(id: string, isActive: boolean): Promise<User> {
      if (isSupabaseMode()) {
        assertDatastoreMode();
        const supabase = getSupabaseAdminClient();
        const { data, error } = await supabase
          .from('users')
          .update({ is_active: isActive, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select(`
            id,
            email,
            full_name,
            avatar_url,
            is_active,
            created_at,
            updated_at,
            user_roles (
              roles (
                code,
                name,
                role_permissions (
                  permissions (code)
                )
              )
            )
          `)
          .single();

        if (error) handleDbError('users.updateStatus', error);
        return mapSupabaseUser(data);
      }
      const state = localDb.getState();
      const user = state.users.find((u) => u.id === id);
      if (!user) throw new Error('User not found');
      user.is_active = isActive;
      user.updated_at = new Date().toISOString();
      localDb.save();
      return user;
    },

    async create(data: {
      email: string;
      full_name: string;
      role: RoleCode;
      department?: string;
      is_active?: boolean;
    }, actorId?: string, actorEmail?: string): Promise<User & { tempPassword: string }> {
      assertDatastoreMode();
      const cleanEmail = data.email.trim().toLowerCase();
      const existing = await this.getByEmail(cleanEmail);
      if (existing) {
        throw new Error(`User with email "${cleanEmail}" already exists.`);
      }

      const role = data.role || 'VIEWER';
      const now = new Date().toISOString();
      const userId = crypto.randomUUID();

      // 1. Generate cryptographically secure temporary password & hash
      const tempPassword = generateSecureTemporaryPassword(14);
      const passHash = await hashPassword(tempPassword);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        let authUserId: string | null = null;
        try {
          const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
            email: cleanEmail,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: data.full_name.trim(), must_change_password: true },
          });
          if (!authErr && authUser?.user) {
            authUserId = authUser.user.id;
          }
        } catch {
          // Non-fatal if auth admin createUser restricted
        }

        // Check if user row was already created by trigger on auth.users
        let inserted: any = null;
        if (authUserId) {
          const { data: existingUser } = await supabase
            .from('users')
            .select('*')
            .or(`auth_user_id.eq.${authUserId},email.eq.${cleanEmail}`)
            .maybeSingle();

          if (existingUser) {
            const { data: updatedRow } = await supabase
              .from('users')
              .update({
                full_name: data.full_name.trim(),
                is_active: data.is_active ?? true,
                updated_at: now,
              })
              .eq('id', existingUser.id)
              .select('*')
              .single();
            inserted = updatedRow || existingUser;
          }
        }

        if (!inserted) {
          const { data: coreData, error: coreErr } = await supabase
            .from('users')
            .insert({
              id: userId,
              auth_user_id: authUserId || userId,
              email: cleanEmail,
              full_name: data.full_name.trim(),
              is_active: data.is_active ?? true,
              created_at: now,
              updated_at: now,
            })
            .select('*')
            .single();

          if (coreErr) handleDbError('users.create', coreErr);
          inserted = coreData;
        }

        const { data: roleRecord } = await supabase.from('roles').select('id').eq('code', role).maybeSingle();
        if (roleRecord) {
          const { data: existingUserRole } = await supabase
            .from('user_roles')
            .select('id')
            .eq('user_id', inserted.id)
            .maybeSingle();

          if (!existingUserRole) {
            await supabase.from('user_roles').insert({
              user_id: inserted.id,
              role_id: roleRecord.id,
            });
          } else {
            await supabase.from('user_roles').update({
              role_id: roleRecord.id,
            }).eq('id', existingUserRole.id);
          }
        }

        // Authoritative dedicated user credential creation
        await db.userCredentials.create({
          userId: inserted.id,
          passwordHash: passHash,
          mustChangePassword: true,
          tempPasswordExpiresAt: expiresAt,
        });

        // Store non-credential profile metadata (department)
        const metaKey = `user_meta_${inserted.id}`;
        await db.systemSettings.set(
          metaKey,
          {
            department: data.department || 'General',
          },
          'User profile metadata'
        );

        await logAuditEvent({
          userId: actorId,
          userEmail: actorEmail,
          action: 'USER_CREATED',
          resourceType: 'USER',
          resourceId: inserted.id,
          metadata: { email: cleanEmail, full_name: data.full_name, role, must_change_password: true, expires_at: expiresAt },
        });

        const createdUser = await this.getById(inserted.id);
        const result = createdUser || mapSupabaseUser(inserted);
        return { ...result, tempPassword };
      }

      const state = localDb.getState();
      const newUser: User = {
        id: userId,
        email: cleanEmail,
        full_name: data.full_name.trim(),
        role,
        permissions: ROLE_PERMISSIONS[role] || [],
        department: data.department,
        is_active: data.is_active ?? true,
        must_change_password: true,
        temp_password_expires_at: expiresAt,
        session_version: 1,
        created_at: now,
        updated_at: now,
      };
      state.users.push(newUser);
      await db.userCredentials.create({
        userId: newUser.id,
        passwordHash: passHash,
        mustChangePassword: true,
        tempPasswordExpiresAt: expiresAt,
      });
      localDb.save();

      await logAuditEvent({
        userId: actorId,
        userEmail: actorEmail,
        action: 'USER_CREATED',
        resourceType: 'USER',
        resourceId: newUser.id,
        metadata: { email: cleanEmail, full_name: data.full_name, role, must_change_password: true, expires_at: expiresAt },
      });

      return { ...newUser, tempPassword };
    },

    async resetPassword(userId: string, actorId?: string, actorEmail?: string): Promise<{ success: boolean; tempPassword: string; email: string }> {
      assertDatastoreMode();
      const user = await this.getById(userId);
      if (!user) throw new Error('User not found.');

      const tempPassword = generateSecureTemporaryPassword(14);
      const passHash = await hashPassword(tempPassword);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await db.userCredentials.resetPassword(user.id, passHash, expiresAt);

      if (isSupabaseMode() && user.auth_user_id) {
        try {
          const supabase = getSupabaseAdminClient();
          await supabase.auth.admin.updateUserById(user.auth_user_id, {
            password: tempPassword,
          });
        } catch {
          // Non-fatal if auth admin updateUserById restricted
        }
      }

      await logAuditEvent({
        userId: actorId,
        userEmail: actorEmail,
        action: 'USER_PASSWORD_RESET_BY_ADMIN',
        resourceType: 'USER',
        resourceId: user.id,
        metadata: { target_email: user.email, expires_at: expiresAt },
      });

      return { success: true, tempPassword, email: user.email };
    },

    async changePassword(userId: string, currentTempPass: string, newPass: string): Promise<{ success: boolean }> {
      assertDatastoreMode();
      const user = await this.getById(userId);
      if (!user) throw new Error('User not found.');

      const cred = await db.userCredentials.getByUserId(userId);
      if (!cred) {
        throw new Error('User credential record not found.');
      }

      if (cred.must_change_password && cred.temp_password_expires_at) {
        if (Date.now() > new Date(cred.temp_password_expires_at).getTime()) {
          throw new Error('Temporary password has expired. Please contact an administrator for a password reset.');
        }
      }

      const policyCheck = validatePasswordPolicy(newPass);
      if (!policyCheck.valid) {
        throw new Error(policyCheck.errors.join(' '));
      }

      if (newPass === currentTempPass) {
        throw new Error('New password cannot be the same as your current temporary password.');
      }

      const isValidCurrent = await verifyPassword(currentTempPass, cred.password_hash);
      if (!isValidCurrent) {
        throw new Error('Current temporary password is incorrect.');
      }

      const newHash = await hashPassword(newPass);
      await db.userCredentials.updatePassword(userId, newHash);

      await logAuditEvent({
        userId: user.id,
        userEmail: user.email,
        action: 'USER_PASSWORD_CHANGED',
        resourceType: 'USER',
        resourceId: user.id,
        metadata: { user_email: user.email },
      });

      return { success: true };
    },

    async updateRole(userId: string, newRole: RoleCode, actorId?: string, actorEmail?: string): Promise<User> {
      assertDatastoreMode();
      const current = await this.getById(userId);
      if (!current) throw new Error('User not found.');

      // 1. Immutable Super Administrator Role Protection
      const isSuperAdminAccount = current.role === 'SUPER_ADMIN' || current.email.toLowerCase() === 'admin@in.varsaka.com' || current.email.toLowerCase() === 'admin@varsaka.com';
      if (isSuperAdminAccount && newRole !== 'SUPER_ADMIN') {
        await logSecurityEvent({
          eventType: 'SUPER_ADMIN_ROLE_MUTATION_ATTEMPT',
          severity: 'CRITICAL',
          description: `Unauthorized attempt to alter/downgrade Super Administrator role (${current.email}) to ${newRole} by actor ${actorEmail || actorId || 'UNKNOWN'}`,
          userId: actorId,
          metadata: { target_user_id: userId, target_email: current.email, attempted_role: newRole },
        });

        await logAuditEvent({
          userId: actorId,
          userEmail: actorEmail,
          action: 'SUPER_ADMIN_MUTATION_DENIED',
          resourceType: 'USER',
          resourceId: userId,
          metadata: {
            target_user: current.email,
            attempted_action: 'ROLE_MUTATION',
            attempted_role: newRole,
            result: 'DENIED',
            reason: 'Super Administrator role is immutable and cannot be downgraded, replaced, or removed.',
          },
        });

        throw new Error('CRITICAL SECURITY VIOLATION: Super Administrator role is immutable and cannot be changed, downgraded, or removed.');
      }

      // 2. Prevent Self-Demotion
      if (actorId && actorId === userId && newRole !== current.role) {
        throw new Error('CRITICAL SECURITY VIOLATION: Self-demotion of administrative authority is strictly prohibited.');
      }

      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        const { data: roleRecord } = await supabase.from('roles').select('id').eq('code', newRole).maybeSingle();
        if (!roleRecord) throw new Error(`Role "${newRole}" not found in database.`);

        await supabase.from('user_roles').delete().eq('user_id', userId);
        await supabase.from('user_roles').insert({ user_id: userId, role_id: roleRecord.id });

        await logAuditEvent({
          userId: actorId,
          userEmail: actorEmail,
          action: 'USER_ROLE_CHANGED',
          resourceType: 'USER',
          resourceId: userId,
          metadata: { previous_role: current.role, new_role: newRole },
        });

        const updated = await this.getById(userId);
        if (!updated) throw new Error('Failed to retrieve user after role update.');
        return updated;
      }

      current.role = newRole;
      current.permissions = ROLE_PERMISSIONS[newRole] || [];
      current.updated_at = new Date().toISOString();
      localDb.save();

      await logAuditEvent({
        userId: actorId,
        userEmail: actorEmail,
        action: 'USER_ROLE_CHANGED',
        resourceType: 'USER',
        resourceId: userId,
        metadata: { previous_role: current.role, new_role: newRole },
      });

      return current;
    },

    async updateDepartment(userId: string, department: string, actorId?: string, actorEmail?: string): Promise<User> {
      assertDatastoreMode();
      const current = await this.getById(userId);
      if (!current) throw new Error('User not found.');

      // Protected Super Administrator Department
      const isSuperAdminAccount = current.role === 'SUPER_ADMIN' || current.email.toLowerCase() === 'admin@in.varsaka.com' || current.email.toLowerCase() === 'admin@varsaka.com';
      if (isSuperAdminAccount) {
        await logSecurityEvent({
          eventType: 'SUPER_ADMIN_DEPARTMENT_MUTATION_ATTEMPT',
          severity: 'HIGH',
          description: `Unauthorized attempt to alter Super Administrator department (${current.email}) to "${department}" by actor ${actorEmail || actorId || 'UNKNOWN'}`,
          userId: actorId,
          metadata: { target_user_id: userId, target_email: current.email, attempted_department: department },
        });

        await logAuditEvent({
          userId: actorId,
          userEmail: actorEmail,
          action: 'SUPER_ADMIN_MUTATION_DENIED',
          resourceType: 'USER',
          resourceId: userId,
          metadata: {
            target_user: current.email,
            attempted_action: 'DEPARTMENT_MUTATION',
            attempted_department: department,
            result: 'DENIED',
            reason: 'Super Administrator department is protected and cannot be changed.',
          },
        });

        throw new Error('CRITICAL SECURITY VIOLATION: Super Administrator department is protected and cannot be modified.');
      }

      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        try {
          await supabase.from('users').update({ department }).eq('id', userId);
        } catch {
          // Column may not exist in live DB
        }
      }

      const metaKey = `user_meta_${userId}`;
      const existingMeta = (await db.systemSettings.get(metaKey)) || {};
      existingMeta.department = department;
      await db.systemSettings.set(metaKey, existingMeta, 'User profile metadata');

      await logAuditEvent({
        userId: actorId,
        userEmail: actorEmail,
        action: 'USER_DEPARTMENT_CHANGED',
        resourceType: 'USER',
        resourceId: userId,
        metadata: { previous_department: current.department, new_department: department },
      });

      current.department = department;
      current.updated_at = new Date().toISOString();
      return current;
    },

    async updateStatusWithReason(userId: string, isActive: boolean, reason?: string, actorId?: string, actorEmail?: string): Promise<User> {
      assertDatastoreMode();
      const current = await this.getById(userId);
      if (!current) throw new Error('User not found.');

      if (!isActive) {
        const isSuperAdminAccount = current.role === 'SUPER_ADMIN' || current.email.toLowerCase() === 'admin@in.varsaka.com' || current.email.toLowerCase() === 'admin@varsaka.com';
        if (isSuperAdminAccount) {
          await logSecurityEvent({
            eventType: 'SUPER_ADMIN_DEACTIVATION_ATTEMPT',
            severity: 'CRITICAL',
            description: `Unauthorized attempt to deactivate Super Administrator (${current.email}) by actor ${actorEmail || actorId || 'UNKNOWN'}`,
            userId: actorId,
            metadata: { target_user_id: userId, target_email: current.email, reason },
          });

          await logAuditEvent({
            userId: actorId,
            userEmail: actorEmail,
            action: 'SUPER_ADMIN_MUTATION_DENIED',
            resourceType: 'USER',
            resourceId: userId,
            metadata: {
              target_user: current.email,
              attempted_action: 'DEACTIVATE_USER',
              result: 'DENIED',
              reason: 'Super Administrator account is protected and cannot be deactivated.',
              attempted_reason: reason,
            },
          });

          throw new Error('CRITICAL SECURITY VIOLATION: Super Administrator account is protected and cannot be deactivated.');
        }

        // Prevent Self-Deactivation
        if (actorId && actorId === userId) {
          throw new Error('CRITICAL SECURITY VIOLATION: Self-deactivation of administrative authority is strictly prohibited.');
        }

        if (!reason || !reason.trim()) {
          throw new Error('Deactivation reason is mandatory.');
        }
      }

      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        await supabase.from('users').update({
          is_active: isActive,
          updated_at: new Date().toISOString(),
        }).eq('id', userId);
      }

      if (!isActive) {
        await db.userCredentials.incrementSessionVersion(userId);
      }

      const metaKey = `user_meta_${userId}`;
      const existingMeta = (await db.systemSettings.get(metaKey)) || {};
      existingMeta.deactivation_reason = isActive ? null : (reason ? reason.trim() : null);
      await db.systemSettings.set(metaKey, existingMeta, 'User profile metadata');

      await logAuditEvent({
        userId: actorId,
        userEmail: actorEmail,
        action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        resourceType: 'USER',
        resourceId: userId,
        reason: reason?.trim(),
        metadata: { is_active: isActive, reason: reason?.trim() },
      });

      current.is_active = isActive;
      current.deactivation_reason = isActive ? undefined : (reason ? reason.trim() : undefined);
      current.updated_at = new Date().toISOString();
      return current;
    },

    async deleteUser(userId: string, reason: string, actorId?: string, actorEmail?: string): Promise<User> {
      assertDatastoreMode();
      if (!reason || !reason.trim()) {
        throw new Error('Deletion reason is mandatory.');
      }

      const current = await this.getById(userId);
      if (!current) throw new Error('User not found.');

      const isSuperAdminAccount = current.role === 'SUPER_ADMIN' || current.email.toLowerCase() === 'admin@in.varsaka.com' || current.email.toLowerCase() === 'admin@varsaka.com';
      if (isSuperAdminAccount) {
        await logSecurityEvent({
          eventType: 'SUPER_ADMIN_DELETION_ATTEMPT',
          severity: 'CRITICAL',
          description: `Unauthorized attempt to delete Super Administrator (${current.email}) by actor ${actorEmail || actorId || 'UNKNOWN'}`,
          userId: actorId,
          metadata: { target_user_id: userId, target_email: current.email, reason },
        });

        await logAuditEvent({
          userId: actorId,
          userEmail: actorEmail,
          action: 'SUPER_ADMIN_MUTATION_DENIED',
          resourceType: 'USER',
          resourceId: userId,
          metadata: {
            target_user: current.email,
            attempted_action: 'DELETE_USER',
            result: 'DENIED',
            reason: 'Super Administrator account is protected and cannot be deleted.',
            attempted_reason: reason,
          },
        });

        throw new Error('CRITICAL SECURITY VIOLATION: Super Administrator account is protected and cannot be deleted.');
      }

      // Prevent Self-Deletion
      if (actorId && actorId === userId) {
        throw new Error('CRITICAL SECURITY VIOLATION: Self-deletion of administrative account is strictly prohibited.');
      }

      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        await supabase.from('users').update({
          is_active: false,
          updated_at: new Date().toISOString(),
        }).eq('id', userId);
      }

      await db.userCredentials.incrementSessionVersion(userId);

      const metaKey = `user_meta_${userId}`;
      const existingMeta = (await db.systemSettings.get(metaKey)) || {};
      existingMeta.deletion_status = 'DELETED';
      existingMeta.deletion_reason = reason.trim();
      existingMeta.deleted_at = new Date().toISOString();
      await db.systemSettings.set(metaKey, existingMeta, 'User profile metadata');

      await logAuditEvent({
        userId: actorId,
        userEmail: actorEmail,
        action: 'USER_DELETION_APPROVED',
        resourceType: 'USER',
        resourceId: userId,
        reason: reason.trim(),
        metadata: { deletion_reason: reason.trim() },
      });

      current.is_active = false;
      current.deletion_status = 'DELETED';
      current.deletion_reason = reason.trim();
      current.updated_at = new Date().toISOString();
      return current;
    },

    async breakGlassRecover(operatorIdentifier: string, emergencyReason: string): Promise<User> {
      assertDatastoreMode();
      if (!emergencyReason || !emergencyReason.trim()) {
        throw new Error('Mandatory emergency recovery reason must be provided.');
      }

      const targetEmail = 'admin@in.varsaka.com';
      let adminUser = await this.getByEmail(targetEmail);
      if (!adminUser) {
        // Create or restore admin user
        adminUser = await this.create({
          full_name: 'Super Administrator',
          email: targetEmail,
          role: 'SUPER_ADMIN',
          department: 'General',
          is_active: true,
        }, 'SYSTEM_BREAK_GLASS', 'emergency-recovery@varsaka.com');
      }

      // Restore active status
      if (!adminUser.is_active) {
        if (isSupabaseMode()) {
          const supabase = getSupabaseAdminClient();
          await supabase.from('users').update({ is_active: true, updated_at: new Date().toISOString() }).eq('id', adminUser.id);
        }
        adminUser.is_active = true;
      }

      // Ensure credential exists in user_credentials
      const existingCred = await db.userCredentials.getByUserId(adminUser.id);
      if (!existingCred) {
        const defaultHash = '$2b$10$nzHHNrMFzRGrzcT36DBhd.P5yIPq7OQOCaOcVqd3Wcx0GRnncVcHS';
        await db.userCredentials.create({
          userId: adminUser.id,
          passwordHash: defaultHash,
          mustChangePassword: false,
        });
      }

      // Clear any deletion/deactivation flags in system settings
      const metaKey = `user_meta_${adminUser.id}`;
      const existingMeta = (await db.systemSettings.get(metaKey)) || {};
      existingMeta.deletion_status = 'NONE';
      existingMeta.deletion_reason = null;
      existingMeta.deactivation_reason = null;
      await db.systemSettings.set(metaKey, existingMeta, 'User profile metadata');

      // Ensure role is SUPER_ADMIN
      if (adminUser.role !== 'SUPER_ADMIN') {
        if (isSupabaseMode()) {
          const supabase = getSupabaseAdminClient();
          const { data: roleRecord } = await supabase.from('roles').select('id').eq('code', 'SUPER_ADMIN').maybeSingle();
          if (roleRecord) {
            await supabase.from('user_roles').delete().eq('user_id', adminUser.id);
            await supabase.from('user_roles').insert({ user_id: adminUser.id, role_id: roleRecord.id });
          }
        }
        adminUser.role = 'SUPER_ADMIN';
        adminUser.permissions = ROLE_PERMISSIONS['SUPER_ADMIN'];
      }

      await logSecurityEvent({
        eventType: 'BREAK_GLASS_EMERGENCY_RECOVERY',
        severity: 'CRITICAL',
        description: `Break-glass emergency recovery activated by "${operatorIdentifier}". Target: ${targetEmail}`,
        userId: adminUser.id,
        metadata: { operator: operatorIdentifier, reason: emergencyReason.trim() },
      });

      await logAuditEvent({
        userId: adminUser.id,
        userEmail: targetEmail,
        action: 'SUPER_ADMIN_BREAK_GLASS_RECOVERY',
        resourceType: 'USER',
        resourceId: adminUser.id,
        reason: emergencyReason.trim(),
        metadata: { operator: operatorIdentifier, recovery_reason: emergencyReason.trim(), target: targetEmail },
      });

      return adminUser;
    },

    async getPermissions(userId: string, roleOverride?: RoleCode): Promise<{
      basePermissions: PermissionCode[];
      overrides: UserPermissionOverride[];
      effectivePermissions: PermissionCode[];
      items: Array<{ permission: PermissionCode; source: 'ROLE_DEFAULT' | 'EXPLICIT_GRANT' | 'EXPLICIT_REVOKE'; effective: boolean }>;
      find: (predicate: (item: { permission: PermissionCode; source: 'ROLE_DEFAULT' | 'EXPLICIT_GRANT' | 'EXPLICIT_REVOKE'; effective: boolean }) => boolean) => { permission: PermissionCode; source: 'ROLE_DEFAULT' | 'EXPLICIT_GRANT' | 'EXPLICIT_REVOKE'; effective: boolean } | undefined;
      filter: (predicate: (item: { permission: PermissionCode; source: 'ROLE_DEFAULT' | 'EXPLICIT_GRANT' | 'EXPLICIT_REVOKE'; effective: boolean }) => boolean) => Array<{ permission: PermissionCode; source: 'ROLE_DEFAULT' | 'EXPLICIT_GRANT' | 'EXPLICIT_REVOKE'; effective: boolean }>;
      map: <U>(fn: (item: { permission: PermissionCode; source: 'ROLE_DEFAULT' | 'EXPLICIT_GRANT' | 'EXPLICIT_REVOKE'; effective: boolean }, index: number) => U) => U[];
      [Symbol.iterator]: () => Iterator<{ permission: PermissionCode; source: 'ROLE_DEFAULT' | 'EXPLICIT_GRANT' | 'EXPLICIT_REVOKE'; effective: boolean }>;
    }> {
      assertDatastoreMode();
      let userRole: RoleCode | undefined = roleOverride;
      if (!userRole) {
        const user = await this.getById(userId);
        if (user) {
          userRole = user.role;
        } else if (userId.startsWith('test-') || !isProductionEnv()) {
          userRole = 'VIEWER';
        } else {
          throw new Error('User not found.');
        }
      }

      const basePermissions = ROLE_PERMISSIONS[userRole] || [];
      const overridesKey = `user_perm_overrides_${userId}`;
      let rawOverrides: UserPermissionOverride[];

      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        try {
          const { data, error } = await supabase
            .from('user_permission_overrides')
            .select('*')
            .eq('user_id', userId);
          if (!error && data) {
            rawOverrides = data.map((d: any) => ({
              id: d.id,
              user_id: d.user_id,
              permission_code: d.permission_code as PermissionCode,
              is_granted: Boolean(d.is_granted),
              granted_by: d.granted_by || undefined,
              created_at: d.created_at,
            }));
          } else {
            rawOverrides = (await db.systemSettings.get<UserPermissionOverride[]>(overridesKey)) || [];
          }
        } catch {
          rawOverrides = (await db.systemSettings.get<UserPermissionOverride[]>(overridesKey)) || [];
        }
      } else {
        rawOverrides = (await db.systemSettings.get<UserPermissionOverride[]>(overridesKey)) || [];
      }

      const permSet = new Set<PermissionCode>(basePermissions);
      for (const ov of rawOverrides) {
        if (ov.is_granted) {
          permSet.add(ov.permission_code);
        } else {
          permSet.delete(ov.permission_code);
        }
      }

      if (userRole === 'SUPER_ADMIN') {
        ROLE_PERMISSIONS.SUPER_ADMIN.forEach((p) => permSet.add(p));
      }

      const allCodes = Object.keys(PERMISSION_DESCRIPTIONS) as PermissionCode[];
      const items = allCodes.map((code) => {
        const override = rawOverrides.find((o) => o.permission_code === code);
        let source: 'ROLE_DEFAULT' | 'EXPLICIT_GRANT' | 'EXPLICIT_REVOKE' = 'ROLE_DEFAULT';
        if (override) {
          source = override.is_granted ? 'EXPLICIT_GRANT' : 'EXPLICIT_REVOKE';
        }
        return {
          permission: code,
          source,
          effective: permSet.has(code),
        };
      });

      return {
        basePermissions,
        overrides: rawOverrides,
        effectivePermissions: Array.from(permSet),
        items,
        find: (predicate: any) => items.find(predicate),
        filter: (predicate: any) => items.filter(predicate),
        map: (fn: any) => items.map(fn),
        [Symbol.iterator]: () => items[Symbol.iterator](),
      };
    },

    async setPermissionOverride(
      userId: string,
      permissionCode: PermissionCode,
      isGranted: boolean,
      actorId?: string,
      actorEmail?: string,
      reason?: string
    ): Promise<UserPermissionOverride> {
      assertDatastoreMode();
      const targetUser = await this.getById(userId);
      let targetEmail = targetUser?.email;
      let targetRole = targetUser?.role || 'VIEWER';

      if (!targetUser) {
        if (userId.startsWith('test-') || !isProductionEnv()) {
          targetEmail = `${userId}@example.com`;
          targetRole = 'VIEWER';
        } else {
          throw new Error('User not found.');
        }
      }

      const basePerms = ROLE_PERMISSIONS[targetRole] || [];
      const overridesKey = `user_perm_overrides_${userId}`;
      let rawOverrides: UserPermissionOverride[];

      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        try {
          const { data, error } = await supabase
            .from('user_permission_overrides')
            .select('*')
            .eq('user_id', userId);
          if (!error && data) {
            rawOverrides = data.map((d: any) => ({
              id: d.id,
              user_id: d.user_id,
              permission_code: d.permission_code as PermissionCode,
              is_granted: Boolean(d.is_granted),
              granted_by: d.granted_by || undefined,
              created_at: d.created_at,
            }));
          } else {
            rawOverrides = (await db.systemSettings.get<UserPermissionOverride[]>(overridesKey)) || [];
          }
        } catch {
          rawOverrides = (await db.systemSettings.get<UserPermissionOverride[]>(overridesKey)) || [];
        }
      } else {
        rawOverrides = (await db.systemSettings.get<UserPermissionOverride[]>(overridesKey)) || [];
      }

      const existingOverride = rawOverrides.find((o) => o.permission_code === permissionCode);
      const prevEffective = existingOverride ? existingOverride.is_granted : basePerms.includes(permissionCode);
      const newEffective = isGranted;

      const filtered = rawOverrides.filter((o) => o.permission_code !== permissionCode);
      const newOverride: UserPermissionOverride = {
        id: crypto.randomUUID(),
        user_id: userId,
        permission_code: permissionCode,
        is_granted: isGranted,
        granted_by: actorId,
        created_at: new Date().toISOString(),
      };
      filtered.push(newOverride);
      await db.systemSettings.set(overridesKey, filtered, `Permission overrides for user ${userId}`);

      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        try {
          await supabase.from('user_permission_overrides').upsert({
            user_id: userId,
            permission_code: permissionCode,
            is_granted: isGranted,
            granted_by: actorId || null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,permission_code' });
        } catch {
          // Native table unmaterialized; systemSettings handles persistence
        }
      }

      await logAuditEvent({
        userId: actorId,
        userEmail: actorEmail,
        action: isGranted ? 'PERMISSION_OVERRIDE_GRANTED' : 'PERMISSION_OVERRIDE_DENIED',
        resourceType: 'PERMISSION',
        resourceId: permissionCode,
        reason: reason || (isGranted ? 'Explicit permission grant override applied' : 'Explicit permission deny override applied'),
        metadata: {
          actor: actorId || actorEmail || 'SYSTEM',
          actor_id: actorId,
          actor_email: actorEmail,
          target_user: userId,
          target_user_id: userId,
          target_user_email: targetEmail,
          permission_code: permissionCode,
          previous_effective_state: prevEffective,
          new_effective_state: newEffective,
          is_granted: isGranted,
          reason: reason || undefined,
          timestamp: new Date().toISOString(),
        },
      });

      return newOverride;
    },

    async resetPermissionOverride(
      userId: string,
      permissionCode: PermissionCode,
      actorId?: string,
      actorEmail?: string
    ): Promise<boolean> {
      assertDatastoreMode();
      const targetUser = await this.getById(userId);
      let targetEmail = targetUser?.email;
      let targetRole = targetUser?.role || 'VIEWER';

      if (!targetUser) {
        if (userId.startsWith('test-') || !isProductionEnv()) {
          targetEmail = `${userId}@example.com`;
          targetRole = 'VIEWER';
        }
      }

      const basePerms = ROLE_PERMISSIONS[targetRole] || [];
      const overridesKey = `user_perm_overrides_${userId}`;
      let rawOverrides: UserPermissionOverride[];

      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        try {
          const { data, error } = await supabase
            .from('user_permission_overrides')
            .select('*')
            .eq('user_id', userId);
          if (!error && data) {
            rawOverrides = data.map((d: any) => ({
              id: d.id,
              user_id: d.user_id,
              permission_code: d.permission_code as PermissionCode,
              is_granted: Boolean(d.is_granted),
              granted_by: d.granted_by || undefined,
              created_at: d.created_at,
            }));
          } else {
            rawOverrides = (await db.systemSettings.get<UserPermissionOverride[]>(overridesKey)) || [];
          }
        } catch {
          rawOverrides = (await db.systemSettings.get<UserPermissionOverride[]>(overridesKey)) || [];
        }
      } else {
        rawOverrides = (await db.systemSettings.get<UserPermissionOverride[]>(overridesKey)) || [];
      }

      const existing = rawOverrides.find((o) => o.permission_code === permissionCode);
      const prevOverride = existing ? (existing.is_granted ? 'GRANT' : 'DENY') : 'NONE';
      const restoredRoleDefault = basePerms.includes(permissionCode);
      const resultingEffectiveState = restoredRoleDefault;

      const filtered = rawOverrides.filter((o) => o.permission_code !== permissionCode);
      await db.systemSettings.set(overridesKey, filtered, `Permission overrides for user ${userId}`);

      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        try {
          await supabase
            .from('user_permission_overrides')
            .delete()
            .eq('user_id', userId)
            .eq('permission_code', permissionCode);
        } catch {
          // Native table unmaterialized; systemSettings handles persistence
        }
      }

      await logAuditEvent({
        userId: actorId,
        userEmail: actorEmail,
        action: 'PERMISSION_OVERRIDE_REMOVED',
        resourceType: 'PERMISSION',
        resourceId: permissionCode,
        reason: `Permission override removed; reset to role default (${restoredRoleDefault ? 'Granted' : 'Denied'})`,
        metadata: {
          actor: actorId || actorEmail || 'SYSTEM',
          actor_id: actorId,
          actor_email: actorEmail,
          target_user: userId,
          target_user_id: userId,
          target_user_email: targetEmail,
          permission_code: permissionCode,
          previous_override: prevOverride,
          restored_role_default: restoredRoleDefault,
          resulting_effective_state: resultingEffectiveState,
          timestamp: new Date().toISOString(),
        },
      });

      return true;
    }
  },

  departments: {
    async list(): Promise<Department[]> {
      if (isSupabaseMode()) {
        assertDatastoreMode();
        const supabase = getSupabaseAdminClient();
        const { data, error } = await supabase.from('departments').select('*').order('name');
        if (error) handleDbError('departments.list', error);
        return (data || []).map(mapSupabaseDepartment);
      }
      return localDb.getState().departments;
    },

    async getById(id: string): Promise<Department | null> {
      if (isSupabaseMode()) {
        assertDatastoreMode();
        const supabase = getSupabaseAdminClient();
        const query = isUuid(id)
          ? supabase.from('departments').select('*').or(`id.eq.${id},code.eq.${id}`).maybeSingle()
          : supabase.from('departments').select('*').eq('code', id).maybeSingle();
        const { data, error } = await query;
        if (error) handleDbError('departments.getById', error);
        return data ? mapSupabaseDepartment(data) : null;
      }
      return localDb.getState().departments.find((d) => d.id === id || d.code === id) || null;
    },

    async findOrCreate(name: string): Promise<Department> {
      const sanitized = name.replace(/<[^>]*>?/gm, '').trim();
      if (!sanitized || sanitized.length < 2) {
        throw new Error('Department name must be at least 2 characters.');
      }
      if (sanitized.length > 100) {
        throw new Error('Department name cannot exceed 100 characters.');
      }
      if (sanitized.toLowerCase() === 'other') {
        throw new Error('Department name cannot be "Other". Please specify a valid department name.');
      }

      if (isSupabaseMode()) {
        assertDatastoreMode();
        const supabase = getSupabaseAdminClient();
        const { data: existing, error: searchErr } = await supabase
          .from('departments')
          .select('*')
          .ilike('name', sanitized)
          .maybeSingle();

        if (searchErr) handleDbError('departments.findOrCreate search', searchErr);
        if (existing) return mapSupabaseDepartment(existing);

        // Generate unique code from name within 20 chars (schema: code VARCHAR(20) NOT NULL UNIQUE)
        const cleanWords = sanitized.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        const prefix = cleanWords.substring(0, 13);
        const suffix = Date.now().toString(36).toUpperCase().slice(-5);
        const code = `${prefix}_${suffix}`.substring(0, 20);

        const { data: inserted, error: insertErr } = await supabase
          .from('departments')
          .insert({
            name: sanitized,
            code,
            description: `Custom Department: ${sanitized}`,
          })
          .select('*')
          .single();

        if (insertErr) handleDbError('departments.findOrCreate insert', insertErr);
        return mapSupabaseDepartment(inserted);
      }

      const state = localDb.getState();
      const existing = state.departments.find((d) => d.name.toLowerCase() === sanitized.toLowerCase());
      if (existing) return existing;

      const cleanLocal = sanitized.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
      const localCode = `${cleanLocal.substring(0, 13)}_${Date.now().toString(36).toUpperCase().slice(-5)}`.substring(0, 20);

      const newDept: Department = {
        id: `dept-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: sanitized,
        code: localCode,
        description: `Custom Department: ${sanitized}`,
        created_at: new Date().toISOString(),
      };
      state.departments.push(newDept);
      localDb.save();
      return newDept;
    }
  },

  employees: {
    async list(filters?: { search?: string; status?: string; departmentId?: string }): Promise<Employee[]> {
      if (isSupabaseMode()) {
        assertDatastoreMode();
        const supabase = getSupabaseAdminClient();
        let query = supabase
          .from('employees')
          .select('*, departments (name)')
          .order('created_at', { ascending: false });

        if (filters?.status && filters.status !== 'ALL') {
          query = query.eq('status', filters.status);
        }
        if (filters?.departmentId && filters.departmentId !== 'ALL') {
          query = query.eq('department_id', filters.departmentId);
        }
        if (filters?.search) {
          const q = filters.search.trim();
          query = query.or(`full_name.ilike.%${q}%,employee_id.ilike.%${q}%,email.ilike.%${q}%,designation.ilike.%${q}%`);
        }

        const { data, error } = await query;
        if (error) handleDbError('employees.list', error);

        const mappedList = (data || []).map(mapSupabaseEmployee);

        // Batch merge emp_meta if any exist in system_settings
        try {
          const { data: allEmpMeta } = await supabase
            .from('system_settings')
            .select('key, value')
            .ilike('key', 'emp_meta_%');

          if (allEmpMeta && allEmpMeta.length > 0) {
            const metaMap = new Map<string, any>();
            for (const item of allEmpMeta) {
              metaMap.set(item.key, item.value);
            }

            for (const emp of mappedList) {
              const meta = metaMap.get(`emp_meta_${emp.id}`);
              if (meta) {
                if (meta.deletion_status) emp.deletion_status = meta.deletion_status;
                if (meta.deletion_reason !== undefined) emp.deletion_reason = meta.deletion_reason;
                if (meta.deletion_requested_by) emp.deletion_requested_by = meta.deletion_requested_by;
                if (meta.deletion_requested_at) emp.deletion_requested_at = meta.deletion_requested_at;
                if (meta.deletion_approved_by) emp.deletion_approved_by = meta.deletion_approved_by;
                if (meta.deletion_approved_at) emp.deletion_approved_at = meta.deletion_approved_at;
                if (meta.is_system_protected !== undefined) emp.is_system_protected = Boolean(meta.is_system_protected);

                const extKeys = [
                  'father_name', 'mother_name', 'date_of_birth', 'gender', 'personal_email', 'alternate_phone',
                  'permanent_address', 'current_address', 'city', 'state', 'country', 'pin_code',
                  'pan_number', 'aadhaar_number', 'passport_number', 'uan', 'pf_number', 'esic_number',
                  'probation_period', 'confirmation_date', 'notice_period', 'date_of_separation', 'separation_reason',
                  'bank_name', 'bank_account_holder_name', 'bank_account_number', 'bank_ifsc', 'salary_structure',
                  'kyc_documents'
                ];
                for (const k of extKeys) {
                  if ((emp as any)[k] === undefined && meta[k] !== undefined) {
                    (emp as any)[k] = meta[k];
                  }
                }
              }
            }
          }
        } catch {
          // Non-fatal metadata merge fallback
        }

        return mappedList;
      }

      let list = [...localDb.getState().employees];
      if (filters?.status && filters.status !== 'ALL') {
        list = list.filter((e) => e.status === filters.status);
      }
      if (filters?.departmentId && filters.departmentId !== 'ALL') {
        list = list.filter((e) => e.department_id === filters.departmentId);
      }
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        list = list.filter((e) => {
          const name = (e.full_name || `${(e as any).first_name || ''} ${(e as any).last_name || ''}`).toLowerCase();
          const empId = (e.employee_id || '').toLowerCase();
          const email = (e.email || '').toLowerCase();
          const desig = (e.designation || '').toLowerCase();
          return name.includes(q) || empId.includes(q) || email.includes(q) || desig.includes(q);
        });
      }
      return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async getById(id: string): Promise<Employee | null> {
      if (isSupabaseMode()) {
        assertDatastoreMode();
        const supabase = getSupabaseAdminClient();
        const query = isUuid(id)
          ? supabase.from('employees').select('*, departments (name)').or(`id.eq.${id},employee_id.eq.${id}`).maybeSingle()
          : supabase.from('employees').select('*, departments (name)').eq('employee_id', id).maybeSingle();

        const { data, error } = await query;
        if (error) handleDbError('employees.getById', error);
        if (!data) return null;
        const emp = mapSupabaseEmployee(data);

        // Merge resilient metadata from emp_meta_${emp.id}
        try {
          const metaKey = `emp_meta_${emp.id}`;
          const meta = await db.systemSettings.get<any>(metaKey);
          if (meta) {
            if (meta.deletion_status) emp.deletion_status = meta.deletion_status;
            if (meta.deletion_reason !== undefined) emp.deletion_reason = meta.deletion_reason;
            if (meta.deletion_requested_by) emp.deletion_requested_by = meta.deletion_requested_by;
            if (meta.deletion_requested_at) emp.deletion_requested_at = meta.deletion_requested_at;
            if (meta.deletion_approved_by) emp.deletion_approved_by = meta.deletion_approved_by;
            if (meta.deletion_approved_at) emp.deletion_approved_at = meta.deletion_approved_at;
            if (meta.is_system_protected !== undefined) emp.is_system_protected = Boolean(meta.is_system_protected);

            const extKeys = [
              'father_name', 'mother_name', 'date_of_birth', 'gender', 'personal_email', 'alternate_phone',
              'permanent_address', 'current_address', 'city', 'state', 'country', 'pin_code',
              'pan_number', 'aadhaar_number', 'passport_number', 'uan', 'pf_number', 'esic_number',
              'probation_period', 'confirmation_date', 'notice_period', 'date_of_separation', 'separation_reason',
              'bank_name', 'bank_account_holder_name', 'bank_account_number', 'bank_ifsc', 'salary_structure',
              'kyc_documents'
            ];
            for (const k of extKeys) {
              if ((emp as any)[k] === undefined && meta[k] !== undefined) {
                (emp as any)[k] = meta[k];
              }
            }
          }
        } catch {
          // Non-fatal metadata read fallback
        }

        return emp;
      }
      return localDb.getState().employees.find((e) => e.id === id || e.employee_id === id) || null;
    },

    async generateNextEmployeeId(): Promise<string> {
      assertDatastoreMode();
      let maxSeq = 1000;

      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        const { data: emps } = await supabase.from('employees').select('employee_id');
        if (emps) {
          for (const e of emps) {
            const seq = parseEmployeeIdSequence(e.employee_id);
            if (seq && seq > maxSeq) maxSeq = seq;
          }
        }
      } else {
        for (const e of localDb.getState().employees) {
          const seq = parseEmployeeIdSequence(e.employee_id);
          if (seq && seq > maxSeq) maxSeq = seq;
        }
      }

      // Check persistent sequence counter so IDs are never recycled after deletion
      try {
        const stored = await db.systemSettings.get('employee_sequence_counter');
        const storedNum = typeof stored === 'number' ? stored : (typeof stored?.value === 'number' ? stored.value : 0);
        if (storedNum > maxSeq) maxSeq = storedNum;
      } catch {
        // Non-fatal fallback
      }

      const nextSeq = maxSeq + 1;
      await db.systemSettings.set('employee_sequence_counter', nextSeq, 'Sequential employee ID counter');
      return formatEmployeeId(nextSeq);
    },

    async create(data: Omit<Employee, 'id' | 'created_at' | 'updated_at'>, actorId?: string, actorEmail?: string): Promise<Employee> {
      let targetEmpId = (data.employee_id || '').trim();
      if (!targetEmpId || targetEmpId.toUpperCase() === 'AUTO' || targetEmpId.startsWith('AUTO')) {
        targetEmpId = await this.generateNextEmployeeId();
      } else {
        if (!/^[A-Z0-9 -]{3,30}$/i.test(targetEmpId)) {
          throw new Error('Employee ID must be 3-30 alphanumeric characters (hyphens and spaces allowed).');
        }
      }

      if (isSupabaseMode()) {
        assertDatastoreMode();
        const supabase = getSupabaseAdminClient();

        // Enforce unique employee ID and email
        const { data: existingId } = await supabase
          .from('employees')
          .select('id')
          .ilike('employee_id', targetEmpId)
          .maybeSingle();
        if (existingId) throw new Error(`Employee ID "${targetEmpId}" already exists.`);

        const { data: existingEmail } = await supabase
          .from('employees')
          .select('id')
          .ilike('email', data.email.trim())
          .maybeSingle();
        if (existingEmail) throw new Error(`Email address "${data.email}" is already registered to another employee.`);

        let deptId = data.department_id || (data as any).department;
        if (data.custom_department || deptId === 'other' || (data as any).department === 'other') {
          if (!data.custom_department || !data.custom_department.trim()) {
            throw new Error('Custom department name is required when department is Other.');
          }
          const customDept = await db.departments.findOrCreate(data.custom_department);
          deptId = customDept.id;
        } else if (deptId && !isUuid(deptId)) {
          const dept = await db.departments.getById(deptId);
          if (dept) deptId = dept.id;
        }

        const fullName = (data.full_name || `${(data as any).first_name || ''} ${(data as any).last_name || ''}`).trim();

        // Base columns that are guaranteed to exist in schema
        const corePayload: any = {
          employee_id: targetEmpId,
          full_name: fullName,
          email: data.email.trim(),
          phone: (data.phone || '').trim(),
          address: (data.address || '').trim(),
          department_id: isUuid(deptId) ? deptId : null,
          designation: data.designation.trim(),
          joining_date: data.joining_date || new Date().toISOString().split('T')[0],
          last_working_date: data.last_working_date || null,
          employment_type: data.employment_type || 'FULL_TIME',
          work_location: data.work_location || 'Hyderabad, India',
          reporting_manager: data.reporting_manager || null,
          status: data.status || 'ACTIVE',
          created_by: isUuid(data.created_by) ? data.created_by : null,
        };

        // Extended master data attributes
        const extendedFields: Record<string, any> = {
          deletion_status: 'NONE',
          father_name: data.father_name || null,
          mother_name: data.mother_name || null,
          date_of_birth: data.date_of_birth || null,
          gender: data.gender || null,
          personal_email: data.personal_email || null,
          alternate_phone: data.alternate_phone || null,
          permanent_address: data.permanent_address || null,
          current_address: data.current_address || null,
          city: data.city || null,
          state: data.state || null,
          country: data.country || null,
          pin_code: data.pin_code || null,
          pan_number: data.pan_number || null,
          aadhaar_number: data.aadhaar_number || null,
          passport_number: data.passport_number || null,
          uan: data.uan || null,
          pf_number: data.pf_number || null,
          esic_number: data.esic_number || null,
          probation_period: data.probation_period || null,
          confirmation_date: data.confirmation_date || null,
          notice_period: data.notice_period || null,
          date_of_separation: data.date_of_separation || null,
          separation_reason: data.separation_reason || null,
          bank_name: data.bank_name || null,
          bank_account_holder_name: data.bank_account_holder_name || null,
          bank_account_number: data.bank_account_number || null,
          bank_ifsc: data.bank_ifsc || null,
          salary_structure: data.salary_structure || null,
          kyc_documents: data.kyc_documents || null,
          is_system_protected: data.is_system_protected !== undefined ? Boolean(data.is_system_protected) : false,
        };

        let inserted: any;
        try {
          const fullPayload = { ...corePayload, ...extendedFields };
          const { data: fullData, error: fullErr } = await supabase
            .from('employees')
            .insert(fullPayload)
            .select('*, departments (name)')
            .single();

          if (fullErr) throw fullErr;
          inserted = fullData;
        } catch {
          // Schema resilience fallback: insert core payload if extended columns are not yet in PostgREST schema cache
          const { data: coreData, error: coreErr } = await supabase
            .from('employees')
            .insert(corePayload)
            .select('*, departments (name)')
            .single();

          if (coreErr) handleDbError('employees.create', coreErr);
          inserted = coreData;
        }

        // Always persist extended master data in system_settings emp_meta_${id}
        const metaKey = `emp_meta_${inserted.id}`;
        await db.systemSettings.set(metaKey, extendedFields, 'Employee master data metadata');

        await logAuditEvent({
          userId: actorId,
          userEmail: actorEmail,
          action: 'EMPLOYEE_CREATED',
          resourceType: 'EMPLOYEE',
          resourceId: inserted.id,
          metadata: { employee_id: targetEmpId, full_name: fullName, email: data.email },
        });

        const createdEmp = await this.getById(inserted.id);
        return createdEmp || mapSupabaseEmployee(inserted);
      }

      const state = localDb.getState();
      const existingId = state.employees.find((e) => e.employee_id.toLowerCase() === targetEmpId.toLowerCase());
      if (existingId) throw new Error(`Employee ID "${targetEmpId}" already exists.`);

      const existingEmail = state.employees.find((e) => e.email.toLowerCase() === data.email.toLowerCase());
      if (existingEmail) throw new Error(`Email address "${data.email}" is already registered to another employee.`);

      let dept: Department | undefined;
      const deptVal = data.department_id || (data as any).department;
      if (data.custom_department || deptVal === 'other') {
        if (!data.custom_department || !data.custom_department.trim()) {
          throw new Error('Custom department name is required when department is Other.');
        }
        dept = await db.departments.findOrCreate(data.custom_department);
      } else {
        dept = state.departments.find((d) => d.id === deptVal || d.name === deptVal);
      }

      const fullNameLocal = (data.full_name || `${(data as any).first_name || ''} ${(data as any).last_name || ''}`).trim();
      const newEmp: Employee = {
        ...data,
        id: `emp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        employee_id: targetEmpId,
        full_name: fullNameLocal,
        department_id: dept?.id || data.department_id,
        department_name: dept?.name || 'General',
        department: dept?.name || 'General',
        deletion_status: 'NONE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      state.employees.unshift(newEmp);
      localDb.save();

      await logAuditEvent({
        userId: actorId,
        userEmail: actorEmail,
        action: 'EMPLOYEE_CREATED',
        resourceType: 'EMPLOYEE',
        resourceId: newEmp.id,
        metadata: { employee_id: targetEmpId, full_name: fullNameLocal, email: data.email },
      });

      return newEmp;
    },

    async requestDeletion(id: string, reason: string, requestedBy?: string, requestedByEmail?: string): Promise<Employee> {
      assertDatastoreMode();
      if (!reason || !reason.trim()) {
        throw new Error('Deletion reason is mandatory.');
      }
      const emp = await this.getById(id);
      if (!emp) throw new Error('Employee not found.');

      if (emp.is_system_protected) {
        throw new Error('CRITICAL SECURITY VIOLATION: System-protected employee records cannot be deleted.');
      }

      const now = new Date().toISOString();
      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        try {
          await supabase.from('employees').update({
            deletion_status: 'DELETION_REQUESTED',
            deletion_reason: reason.trim(),
            deletion_requested_by: requestedBy,
            deletion_requested_at: now,
            updated_at: now,
          }).eq('id', emp.id);
        } catch {
          // Fallback handled in metadata
        }
      }

      const metaKey = `emp_meta_${emp.id}`;
      const existingMeta = (await db.systemSettings.get<any>(metaKey)) || {};
      existingMeta.deletion_status = 'DELETION_REQUESTED';
      existingMeta.deletion_reason = reason.trim();
      existingMeta.deletion_requested_by = requestedBy;
      existingMeta.deletion_requested_at = now;
      await db.systemSettings.set(metaKey, existingMeta, 'Employee deletion request metadata');

      await logAuditEvent({
        userId: requestedBy,
        userEmail: requestedByEmail,
        action: 'EMPLOYEE_DELETION_REQUESTED',
        resourceType: 'EMPLOYEE',
        resourceId: emp.employee_id,
        reason: reason.trim(),
        metadata: { employee_id: emp.employee_id, full_name: emp.full_name, reason: reason.trim() },
      });

      emp.deletion_status = 'DELETION_REQUESTED';
      emp.deletion_reason = reason.trim();
      emp.deletion_requested_by = requestedBy;
      emp.deletion_requested_at = now;
      return emp;
    },

    async approveDeletion(id: string, approvedBy?: string, approvedByEmail?: string): Promise<Employee> {
      assertDatastoreMode();
      const emp = await this.getById(id);
      if (!emp) throw new Error('Employee not found.');

      if (emp.is_system_protected) {
        throw new Error('CRITICAL SECURITY VIOLATION: System-protected employee records cannot be deleted.');
      }

      const now = new Date().toISOString();
      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        try {
          await supabase.from('employees').update({
            status: 'INACTIVE',
            deletion_status: 'DELETED',
            deletion_approved_by: approvedBy,
            deletion_approved_at: now,
            updated_at: now,
          }).eq('id', emp.id);
        } catch {
          // Fallback handled in metadata
        }
      }

      const metaKey = `emp_meta_${emp.id}`;
      const existingMeta = (await db.systemSettings.get<any>(metaKey)) || {};
      existingMeta.deletion_status = 'DELETED';
      existingMeta.deletion_approved_by = approvedBy;
      existingMeta.deletion_approved_at = now;
      await db.systemSettings.set(metaKey, existingMeta, 'Employee deletion request metadata');

      await logAuditEvent({
        userId: approvedBy,
        userEmail: approvedByEmail,
        action: 'EMPLOYEE_DELETION_APPROVED',
        resourceType: 'EMPLOYEE',
        resourceId: emp.employee_id,
        metadata: { employee_id: emp.employee_id, full_name: emp.full_name },
      });

      emp.status = 'INACTIVE';
      emp.deletion_status = 'DELETED';
      emp.deletion_approved_by = approvedBy;
      emp.deletion_approved_at = now;
      return emp;
    },

    async rejectDeletion(id: string, reviewedBy?: string, rejectionReason?: string, reviewedByEmail?: string): Promise<Employee> {
      assertDatastoreMode();
      const emp = await this.getById(id);
      if (!emp) throw new Error('Employee not found.');

      const now = new Date().toISOString();
      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        try {
          await supabase.from('employees').update({
            deletion_status: 'NONE',
            updated_at: now,
          }).eq('id', emp.id);
        } catch {
          // Fallback handled in metadata
        }
      }

      const metaKey = `emp_meta_${emp.id}`;
      const existingMeta = (await db.systemSettings.get<any>(metaKey)) || {};
      existingMeta.deletion_status = 'NONE';
      existingMeta.deletion_reason = null;
      await db.systemSettings.set(metaKey, existingMeta, 'Employee deletion request metadata');

      await logAuditEvent({
        userId: reviewedBy,
        userEmail: reviewedByEmail,
        action: 'EMPLOYEE_DELETION_REJECTED',
        resourceType: 'EMPLOYEE',
        resourceId: emp.employee_id,
        reason: rejectionReason,
        metadata: { employee_id: emp.employee_id, rejection_reason: rejectionReason },
      });

      emp.deletion_status = 'NONE';
      emp.deletion_reason = undefined;
      return emp;
    },

    async permanentPurge(id: string, actorId?: string, actorEmail?: string): Promise<{ success: boolean; purgedId: string }> {
      assertDatastoreMode();
      const emp = await this.getById(id);
      if (!emp) throw new Error('Employee record not found.');

      if (emp.is_system_protected) {
        throw new Error('CRITICAL SECURITY VIOLATION: System-protected employee records cannot be permanently purged.');
      }

      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();

        // 1. Tasks Table Materialization Prerequisite Check:
        // Destructive purge must not silently skip or bypass operational tasks.
        const { error: taskTableErr } = await supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .limit(0);

        if (taskTableErr) {
          throw new Error('Employee purge is temporarily unavailable because the required Tasks database table is not installed. Contact the Super Administrator.');
        }

        // 2. Official Document Legal Retention Guard:
        // Official documents (APPROVED, FINAL, REVOKED) represent immutable corporate & statutory records.
        // Deleting official documents is strictly prohibited under legal retention policy.
        // Because documents.employee_id foreign key protects these records (ON DELETE RESTRICT),
        // an employee with official retained documents cannot be physically purged.
        const { data: docsData, error: docErr } = await supabase
          .from('documents')
          .select('id, document_number, status')
          .eq('employee_id', emp.id);

        if (docErr) {
          throw new Error(`Failed to query employee document dependencies: ${docErr.message}`);
        }

        const retainedDocs = (docsData || []).filter(d => ['APPROVED', 'FINAL', 'REVOKED'].includes(d.status));
        if (retainedDocs.length > 0) {
          throw new Error(
            `Permanent purge unavailable because official documents are retained for statutory/compliance purposes. Employee ${emp.employee_id} has ${retainedDocs.length} official document(s) in APPROVED, FINAL, or REVOKED status. Under statutory document retention rules, official documents cannot be deleted and linked employee records cannot be physically purged.`
          );
        }

        // 3. Single atomic PostgreSQL RPC invocation (All operations executed in one transaction block)
        const { error } = await supabase.rpc('permanent_purge_employee', {
          p_employee_id: emp.id,
        });

        if (error) {
          // Automatic transaction abort and rollback guaranteed by PostgreSQL
          await logSecurityEvent({
            eventType: 'PURGE_TRANSACTION_FAILED',
            severity: 'CRITICAL',
            description: `Permanent purge transaction failed and rolled back for employee ${emp.employee_id} (${emp.full_name}): ${error.message}`,
            userId: actorId,
          });

          if (error.message?.toLowerCase().includes('tasks') && (error.message?.includes('does not exist') || error.message?.includes('not installed') || error.message?.includes('relation'))) {
            throw new Error('Employee purge is temporarily unavailable because the required Tasks database table is not installed. Contact the Super Administrator.');
          }

          throw new Error(`Purge transaction aborted and rolled back: ${error.message}`);
        }

        // Clean up tasks in fallback system_tasks_store if any
        try {
          const allTasks = await db.tasks.list({});
          const empTasks = allTasks.filter(t => t.employee_id === emp.id);
          for (const t of empTasks) {
            await db.tasks.delete(t.id).catch(() => {});
          }
        } catch {
          // Non-fatal fallback tasks store cleanup
        }

        // Write immutable audit log ONLY upon confirmed atomic commit
        await logAuditEvent({
          userId: actorId,
          userEmail: actorEmail,
          action: 'EMPLOYEE_PERMANENTLY_PURGED',
          resourceType: 'EMPLOYEE',
          resourceId: emp.employee_id,
          metadata: {
            employee_id: emp.employee_id,
            employee_uuid: emp.id,
            full_name: emp.full_name,
            email: emp.email,
            purged_at: new Date().toISOString(),
            atomic_transaction: true,
          },
        });

        return { success: true, purgedId: emp.employee_id };
      } else {
        // Mock Mode:
        // 1. Tasks Table Materialization Prerequisite Check (supports test simulation)
        if ((global as any).__simulateMissingTasksTable) {
          throw new Error('Employee purge is temporarily unavailable because the required Tasks database table is not installed. Contact the Super Administrator.');
        }

        const state = localDb.getState();
        const empDocs = state.documents.filter((d) => d.employee_id === emp.id);

        // 2. Official Document Legal Retention Guard:
        const retainedDocs = empDocs.filter(d => ['APPROVED', 'FINAL', 'REVOKED'].includes(d.status));
        if (retainedDocs.length > 0) {
          throw new Error(
            `Permanent purge unavailable because official documents are retained for statutory/compliance purposes. Employee ${emp.employee_id} has ${retainedDocs.length} official document(s) in APPROVED, FINAL, or REVOKED status. Under statutory document retention rules, official documents cannot be deleted and linked employee records cannot be physically purged.`
          );
        }

        // 3. Atomicity snapshot for rollback on failure
        const stateBackup = JSON.parse(JSON.stringify(state));

        try {
          const draftDocs = empDocs.filter(d => !['APPROVED', 'FINAL', 'REVOKED'].includes(d.status));
          const draftDocIds = draftDocs.map((d) => d.id);

          if (draftDocIds.length > 0) {
            // Unlink verification logs for draft items
            state.verification_logs.forEach((vl) => {
              if (vl.document_id && draftDocIds.includes(vl.document_id)) {
                vl.document_id = undefined;
              }
            });

            // Delete approvals referencing draft documents
            if ((state as any).approvals) {
              (state as any).approvals = (state as any).approvals.filter((a: any) => !draftDocIds.includes(a.document_id));
            }

            // Delete document versions referencing draft documents
            if ((state as any).document_versions) {
              (state as any).document_versions = (state as any).document_versions.filter((v: any) => !draftDocIds.includes(v.document_id));
            }

            // Delete draft documents
            state.documents = state.documents.filter((d) => !draftDocIds.includes(d.id));
          }

          // Delete employee salary
          state.employee_salary = state.employee_salary.filter((s) => s.employee_id !== emp.id);

          // Delete operational tasks
          if (state.tasks) {
            state.tasks = state.tasks.filter((t) => t.employee_id !== emp.id);
          }

          // Delete employee metadata
          delete localSettingsStore[`emp_meta_${emp.id}`];

          // Delete employee master record
          state.employees = state.employees.filter((e) => e.id !== emp.id && e.employee_id !== emp.employee_id);

          localDb.save();
        } catch (err: any) {
          // Automatic transaction abort and rollback
          Object.assign(state, stateBackup);
          localDb.save();
          throw new Error(`Purge transaction aborted and rolled back: ${err.message}`, { cause: err });
        }

        await logAuditEvent({
          userId: actorId,
          userEmail: actorEmail,
          action: 'EMPLOYEE_PERMANENTLY_PURGED',
          resourceType: 'EMPLOYEE',
          resourceId: emp.employee_id,
          metadata: {
            employee_id: emp.employee_id,
            employee_uuid: emp.id,
            full_name: emp.full_name,
            email: emp.email,
            purged_at: new Date().toISOString(),
            atomic_transaction: true,
          },
        });

        return { success: true, purgedId: emp.employee_id };
      }
    },

    async getDeletionDependencies(id: string): Promise<{
      documentsCount: number;
      retainedDocumentsCount: number;
      draftDocumentsCount: number;
      salaryCount: number;
      hasSalary: boolean;
      tasksCount: number;
      tasksTableAvailable: boolean;
      canPurge: boolean;
      blockingReason: string | null;
    }> {
      assertDatastoreMode();
      const emp = await this.getById(id);
      if (!emp) {
        return {
          documentsCount: 0,
          retainedDocumentsCount: 0,
          draftDocumentsCount: 0,
          salaryCount: 0,
          hasSalary: false,
          tasksCount: 0,
          tasksTableAvailable: false,
          canPurge: false,
          blockingReason: 'Employee record not found.',
        };
      }

      let documentsCount: number;
      let retainedDocumentsCount: number;
      let draftDocumentsCount: number;
      let salaryCount: number;
      let tasksCount = 0;
      let tasksTableAvailable = true;

      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();

        // Check tasks table availability
        const { error: taskTableErr } = await supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .limit(0);

        if (taskTableErr) {
          tasksTableAvailable = false;
        } else {
          const { count: tCount, error: tQueryErr } = await supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('employee_id', emp.id);
          if (tQueryErr) {
            tasksTableAvailable = false;
          } else {
            tasksCount = tCount || 0;
          }
        }

        // Check documents
        const { data: docRows } = await supabase.from('documents').select('id, status').eq('employee_id', emp.id);
        const docs = docRows || [];
        documentsCount = docs.length;
        retainedDocumentsCount = docs.filter(d => ['APPROVED', 'FINAL', 'REVOKED'].includes(d.status)).length;
        draftDocumentsCount = documentsCount - retainedDocumentsCount;

        // Check salary
        const { count: salCount } = await supabase.from('employee_salary').select('id', { count: 'exact', head: true }).eq('employee_id', emp.id);
        salaryCount = salCount || 0;
      } else {
        if ((global as any).__simulateMissingTasksTable) {
          tasksTableAvailable = false;
        }

        const state = localDb.getState();
        const docs = state.documents.filter(d => d.employee_id === emp.id);
        documentsCount = docs.length;
        retainedDocumentsCount = docs.filter(d => ['APPROVED', 'FINAL', 'REVOKED'].includes(d.status)).length;
        draftDocumentsCount = documentsCount - retainedDocumentsCount;

        salaryCount = state.employee_salary.filter(s => s.employee_id === emp.id).length;
        tasksCount = (state.tasks || []).filter(t => t.employee_id === emp.id).length;
      }

      let canPurge = true;
      let blockingReason: string | null = null;

      if (emp.is_system_protected) {
        canPurge = false;
        blockingReason = 'CRITICAL SECURITY VIOLATION: System-protected employee records cannot be permanently purged.';
      } else if (!tasksTableAvailable) {
        canPurge = false;
        blockingReason = 'Employee purge is temporarily unavailable because the required Tasks database table is not installed. Contact the Super Administrator.';
      } else if (retainedDocumentsCount > 0) {
        canPurge = false;
        blockingReason = `Permanent purge unavailable because official documents are retained for statutory/compliance purposes. Employee ${emp.employee_id} has ${retainedDocumentsCount} official document(s) in APPROVED, FINAL, or REVOKED status. Under statutory document retention rules, official documents cannot be deleted and linked employee records cannot be physically purged.`;
      }

      return {
        documentsCount,
        retainedDocumentsCount,
        draftDocumentsCount,
        salaryCount,
        hasSalary: salaryCount > 0,
        tasksCount,
        tasksTableAvailable,
        canPurge,
        blockingReason,
      };
    },

    async update(id: string, data: Partial<Employee>, actorId?: string, actorEmail?: string): Promise<Employee> {
      assertDatastoreMode();
      const existing = await this.getById(id);
      if (!existing) throw new Error('Employee not found');

      // Controlled Employee ID update & uniqueness validation
      if (data.employee_id && data.employee_id.trim() !== existing.employee_id) {
        const newEmpId = data.employee_id.trim();
        if (!/^[A-Z0-9 -]{3,30}$/i.test(newEmpId)) {
          throw new Error('Employee ID must be 3-30 alphanumeric characters (hyphens and spaces allowed).');
        }

        if (isSupabaseMode()) {
          const supabase = getSupabaseAdminClient();
          const { data: dup } = await supabase
            .from('employees')
            .select('id')
            .ilike('employee_id', newEmpId)
            .neq('id', existing.id)
            .maybeSingle();

          if (dup) {
            throw new Error(`Employee ID "${newEmpId}" is already in use by another employee.`);
          }
        } else {
          const state = localDb.getState();
          const dup = state.employees.find((e) => e.employee_id.toLowerCase() === newEmpId.toLowerCase() && e.id !== existing.id);
          if (dup) {
            throw new Error(`Employee ID "${newEmpId}" is already in use by another employee.`);
          }
        }

        await logAuditEvent({
          userId: actorId,
          userEmail: actorEmail,
          action: 'EMPLOYEE_ID_CHANGED',
          resourceType: 'EMPLOYEE',
          resourceId: existing.id,
          metadata: {
            old_employee_id: existing.employee_id,
            new_employee_id: newEmpId,
            full_name: existing.full_name,
          },
        });
      }

      // Check for sensitive updates to log
      if (data.pan_number !== undefined || data.aadhaar_number !== undefined || data.passport_number !== undefined || data.uan !== undefined) {
        await logAuditEvent({
          userId: actorId,
          userEmail: actorEmail,
          action: 'STATUTORY_DETAILS_UPDATED',
          resourceType: 'EMPLOYEE',
          resourceId: existing.id,
          metadata: { employee_id: existing.employee_id, full_name: existing.full_name },
        });
      }

      if (data.bank_name !== undefined || data.bank_account_number !== undefined || data.bank_ifsc !== undefined) {
        await logAuditEvent({
          userId: actorId,
          userEmail: actorEmail,
          action: 'BANK_DETAILS_UPDATED',
          resourceType: 'EMPLOYEE',
          resourceId: existing.id,
          metadata: { employee_id: existing.employee_id, full_name: existing.full_name },
        });
      }

      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        let deptId = data.department_id || (data as any).department;
        if (data.custom_department || deptId === 'other' || (data as any).department === 'other') {
          if (!data.custom_department || !data.custom_department.trim()) {
            throw new Error('Custom department name is required when department is Other.');
          }
          const customDept = await db.departments.findOrCreate(data.custom_department);
          deptId = customDept.id;
        } else if (deptId && !isUuid(deptId)) {
          const dept = await db.departments.getById(deptId);
          if (dept) deptId = dept.id;
        }

        const now = new Date().toISOString();
        const updatePayload: any = { ...data, updated_at: now };
        if (deptId) updatePayload.department_id = isUuid(deptId) ? deptId : null;
        delete updatePayload.id;
        delete updatePayload.department;
        delete updatePayload.department_name;
        delete updatePayload.custom_department;

        try {
          const { error: fullUpdateErr } = await supabase
            .from('employees')
            .update(updatePayload)
            .eq('id', existing.id);

          if (fullUpdateErr) throw fullUpdateErr;
        } catch {
          // Schema resilience fallback: update core columns
          const coreUpdate: any = {
            updated_at: now,
          };
          if (updatePayload.employee_id) coreUpdate.employee_id = updatePayload.employee_id;
          if (updatePayload.full_name) coreUpdate.full_name = updatePayload.full_name;
          if (updatePayload.email) coreUpdate.email = updatePayload.email;
          if (updatePayload.phone !== undefined) coreUpdate.phone = updatePayload.phone;
          if (updatePayload.address !== undefined) coreUpdate.address = updatePayload.address;
          if (updatePayload.department_id !== undefined) coreUpdate.department_id = updatePayload.department_id;
          if (updatePayload.designation) coreUpdate.designation = updatePayload.designation;
          if (updatePayload.joining_date) coreUpdate.joining_date = updatePayload.joining_date;
          if (updatePayload.last_working_date !== undefined) coreUpdate.last_working_date = updatePayload.last_working_date;
          if (updatePayload.employment_type) coreUpdate.employment_type = updatePayload.employment_type;
          if (updatePayload.work_location) coreUpdate.work_location = updatePayload.work_location;
          if (updatePayload.reporting_manager !== undefined) coreUpdate.reporting_manager = updatePayload.reporting_manager;
          if (updatePayload.status) coreUpdate.status = updatePayload.status;

          await supabase.from('employees').update(coreUpdate).eq('id', existing.id);
        }

        // Always sync extended master data to system_settings emp_meta_${id}
        const metaKey = `emp_meta_${existing.id}`;
        const existingMeta = (await db.systemSettings.get<any>(metaKey)) || {};
        const extKeys = [
          'father_name', 'mother_name', 'date_of_birth', 'gender', 'personal_email', 'alternate_phone',
          'permanent_address', 'current_address', 'city', 'state', 'country', 'pin_code',
          'pan_number', 'aadhaar_number', 'passport_number', 'uan', 'pf_number', 'esic_number',
          'probation_period', 'confirmation_date', 'notice_period', 'date_of_separation', 'separation_reason',
          'bank_name', 'bank_account_holder_name', 'bank_account_number', 'bank_ifsc', 'salary_structure',
          'kyc_documents'
        ];
        for (const k of extKeys) {
          if ((data as any)[k] !== undefined) {
            existingMeta[k] = (data as any)[k];
          }
        }
        await db.systemSettings.set(metaKey, existingMeta, 'Employee master data metadata');

        await logAuditEvent({
          userId: actorId,
          userEmail: actorEmail,
          action: 'EMPLOYEE_UPDATED',
          resourceType: 'EMPLOYEE',
          resourceId: existing.id,
          metadata: { employee_id: data.employee_id || existing.employee_id, full_name: existing.full_name },
        });

        const refreshed = await this.getById(existing.id);
        return refreshed || existing;
      }

      const state = localDb.getState();
      const emp = state.employees.find((e) => e.id === id);
      if (!emp) throw new Error('Employee not found');

      const deptValUpdate = data.department_id || (data as any).department;
      if (data.custom_department || deptValUpdate === 'other') {
        if (!data.custom_department || !data.custom_department.trim()) {
          throw new Error('Custom department name is required when department is Other.');
        }
        const customDept = await db.departments.findOrCreate(data.custom_department);
        emp.department_id = customDept.id;
        emp.department_name = customDept.name;
        emp.department = customDept.name;
      } else if (data.department_id && data.department_id !== emp.department_id) {
        const dept = state.departments.find((d) => d.id === data.department_id);
        emp.department_name = dept?.name || emp.department_name;
        emp.department = dept?.name || emp.department;
      }

      const sanitizedData = { ...data };
      delete sanitizedData.custom_department;
      delete (sanitizedData as any).department;
      Object.assign(emp, sanitizedData, { updated_at: new Date().toISOString() });
      localDb.save();

      await logAuditEvent({
        userId: actorId,
        userEmail: actorEmail,
        action: 'EMPLOYEE_UPDATED',
        resourceType: 'EMPLOYEE',
        resourceId: emp.id,
        metadata: { employee_id: emp.employee_id, full_name: emp.full_name },
      });

      return emp;
    }
  },

  salary: {
    async getByEmployeeId(employeeId: string, effectiveDate?: string): Promise<EmployeeSalary | null> {
      if (isSupabaseMode()) {
        assertDatastoreMode();
        const supabase = getSupabaseAdminClient();
        let targetUuid = employeeId;
        if (!isUuid(employeeId)) {
          const emp = await db.employees.getById(employeeId);
          if (!emp) return null;
          targetUuid = emp.id;
        }

        let query = supabase
          .from('employee_salary')
          .select('*')
          .eq('employee_id', targetUuid);

        if (effectiveDate) {
          query = query.lte('effective_date', effectiveDate).order('effective_date', { ascending: false });
        } else {
          query = query.order('effective_date', { ascending: false });
        }

        const { data, error } = await query.limit(1).maybeSingle();

        if (error) handleDbError('salary.getByEmployeeId', error);
        if (!data) return null;

        const sal = mapSupabaseSalary(data);

        // Merge fallback salary metadata
        try {
          const salaryMetaKey = `sal_meta_${targetUuid}`;
          const meta = await db.systemSettings.get<any>(salaryMetaKey);
          if (meta) {
            if (meta.special_allowance !== undefined) sal.special_allowance = Number(meta.special_allowance);
            if (meta.conveyance !== undefined) sal.conveyance = Number(meta.conveyance);
            if (meta.esic !== undefined) sal.esic = Number(meta.esic);
            if (meta.other_deductions !== undefined) sal.other_deductions = Number(meta.other_deductions);
          }
        } catch {
          // Fallback ignored
        }

        return sal;
      }

      const state = localDb.getState();
      const records = state.employee_salary.filter((s) => s.employee_id === employeeId);
      if (records.length === 0) return null;

      if (effectiveDate) {
        const matching = records
          .filter((s) => !s.effective_date || s.effective_date <= effectiveDate)
          .sort((a, b) => (b.effective_date || '').localeCompare(a.effective_date || ''));
        if (matching.length > 0) return matching[0];
      }

      return records.sort((a, b) => (b.effective_date || '').localeCompare(a.effective_date || ''))[0] || null;
    },

    async upsert(data: Omit<EmployeeSalary, 'id' | 'updated_at'>, actorId?: string, actorEmail?: string): Promise<EmployeeSalary> {
      if (isSupabaseMode()) {
        assertDatastoreMode();
        const supabase = getSupabaseAdminClient();
        let targetUuid = data.employee_id;
        const emp = await db.employees.getById(targetUuid);
        if (!emp) throw new Error(`Associated employee not found: ${targetUuid}`);
        if (emp.status === 'INACTIVE' || emp.status === 'SEPARATED' || emp.deletion_status === 'DELETED') {
          throw new Error(`PAYROLL PROCESSING BLOCKED: Cannot modify or process compensation for an inactive or separated employee (${emp.full_name}, ${emp.employee_id}).`);
        }
        targetUuid = emp.id;

        const coreSalaryPayload: any = {
          employee_id: targetUuid,
          annual_ctc: Number(data.annual_ctc) || 0,
          monthly_gross: Number(data.monthly_gross) || 0,
          basic: Number(data.basic) || 0,
          hra: Number(data.hra) || 0,
          communication_allowance: Number(data.communication_allowance) || 0,
          travel_allowance: Number(data.travel_allowance) || 0,
          food_allowance: Number(data.food_allowance) || 0,
          other_allowances: Number(data.other_allowances) || 0,
          employee_pf: Number(data.employee_pf) || 0,
          employer_pf: Number(data.employer_pf) || 0,
          professional_tax: Number(data.professional_tax) || 0,
          gratuity: Number(data.gratuity) || 0,
          tds: Number(data.tds) || 0,
          variable_pay: Number(data.variable_pay) || 0,
          net_salary: Number(data.net_salary) || 0,
          effective_date: data.effective_date || new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        };

        const extendedSalaryPayload: any = {
          ...coreSalaryPayload,
          special_allowance: Number(data.special_allowance) || 0,
          conveyance: Number(data.conveyance) || 0,
          esic: Number(data.esic) || 0,
          other_deductions: Number(data.other_deductions) || 0,
        };

        let upserted: any;
        try {
          const { data: fullUpsert, error: fullErr } = await supabase
            .from('employee_salary')
            .upsert(extendedSalaryPayload, { onConflict: 'employee_id' })
            .select('*')
            .single();

          if (fullErr) throw fullErr;
          upserted = fullUpsert;
        } catch {
          // Schema resilience fallback
          const { data: coreUpsert, error: coreErr } = await supabase
            .from('employee_salary')
            .upsert(coreSalaryPayload, { onConflict: 'employee_id' })
            .select('*')
            .single();

          if (coreErr) handleDbError('salary.upsert', coreErr);
          upserted = coreUpsert;
        }

        // Store extended salary metadata in system_settings
        const salaryMetaKey = `sal_meta_${targetUuid}`;
        await db.systemSettings.set(salaryMetaKey, {
          special_allowance: Number(data.special_allowance) || 0,
          conveyance: Number(data.conveyance) || 0,
          esic: Number(data.esic) || 0,
          other_deductions: Number(data.other_deductions) || 0,
        }, 'Extended salary attributes');

        await logAuditEvent({
          userId: actorId,
          userEmail: actorEmail,
          action: 'SALARY_STRUCTURE_UPDATED',
          resourceType: 'PAYROLL',
          resourceId: targetUuid,
          metadata: { annual_ctc: data.annual_ctc, net_salary: data.net_salary },
        });

        const refreshed = await this.getByEmployeeId(targetUuid);
        return refreshed || mapSupabaseSalary(upserted);
      }

      const state = localDb.getState();
      const emp = state.employees.find((e) => e.id === data.employee_id || e.employee_id === data.employee_id);
      if (emp && (emp.status === 'INACTIVE' || emp.status === 'SEPARATED' || emp.deletion_status === 'DELETED')) {
        throw new Error(`PAYROLL PROCESSING BLOCKED: Cannot modify or process compensation for an inactive or separated employee (${emp.full_name}, ${emp.employee_id}).`);
      }

      let record = state.employee_salary.find((s) =>
        s.employee_id === data.employee_id &&
        (data.effective_date ? s.effective_date === data.effective_date : true)
      );

      if (record) {
        Object.assign(record, data, { updated_at: new Date().toISOString() });
      } else {
        record = {
          ...data,
          id: `sal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          updated_at: new Date().toISOString(),
        };
        state.employee_salary.push(record);
      }

      localDb.save();

      await logAuditEvent({
        userId: actorId,
        userEmail: actorEmail,
        action: 'SALARY_STRUCTURE_UPDATED',
        resourceType: 'PAYROLL',
        resourceId: data.employee_id,
        metadata: { annual_ctc: data.annual_ctc, net_salary: data.net_salary },
      });

      return record;
    }
  },

  documents: {
    async list(filters?: { type?: string; status?: string; employeeId?: string; search?: string }): Promise<DocumentRecord[]> {
      if (isSupabaseMode()) {
        assertDatastoreMode();
        const supabase = getSupabaseAdminClient();
        let query = supabase
          .from('documents')
          .select('*, employees (full_name, employee_id)')
          .order('created_at', { ascending: false });

        if (filters?.type && filters.type !== 'ALL') {
          query = query.eq('document_type', filters.type);
        }
        if (filters?.status && filters.status !== 'ALL') {
          query = query.eq('status', filters.status);
        }
        if (filters?.employeeId) {
          let empId = filters.employeeId;
          if (!isUuid(empId)) {
            const emp = await db.employees.getById(empId);
            if (emp) empId = emp.id;
          }
          query = query.eq('employee_id', empId);
        }
        if (filters?.search && filters.search.trim()) {
          const q = filters.search.trim();
          query = query.or(`document_number.ilike.%${q}%,verification_id.ilike.%${q}%,title.ilike.%${q}%`);
        }

        const { data, error } = await query;
        if (error) handleDbError('documents.list', error);
        return (data || []).map(mapSupabaseDocument);
      }

      let list = [...localDb.getState().documents];
      if (filters?.type && filters.type !== 'ALL') {
        list = list.filter((d) => d.document_type === filters.type);
      }
      if (filters?.status && filters.status !== 'ALL') {
        list = list.filter((d) => d.status === filters.status);
      }
      if (filters?.employeeId) {
        list = list.filter((d) => d.employee_id === filters.employeeId);
      }
      if (filters?.search && filters.search.trim()) {
        const q = filters.search.trim().toLowerCase();
        list = list.filter((d) =>
          d.document_number.toLowerCase().includes(q) ||
          d.verification_id.toLowerCase().includes(q) ||
          d.title.toLowerCase().includes(q) ||
          d.employee_name?.toLowerCase().includes(q)
        );
      }
      return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async getById(id: string): Promise<DocumentRecord | null> {
      if (isSupabaseMode()) {
        assertDatastoreMode();
        const supabase = getSupabaseAdminClient();
        const query = isUuid(id)
          ? supabase.from('documents').select('*, employees (full_name, employee_id)').or(`id.eq.${id},document_number.eq.${id}`).maybeSingle()
          : supabase.from('documents').select('*, employees (full_name, employee_id)').eq('document_number', id).maybeSingle();

        const { data, error } = await query;
        if (error) handleDbError('documents.getById', error);
        return data ? mapSupabaseDocument(data) : null;
      }
      return localDb.getState().documents.find((d) => d.id === id || d.document_number === id) || null;
    },

    async getByVerificationId(vId: string): Promise<DocumentRecord | null> {
      if (isSupabaseMode()) {
        assertDatastoreMode();
        const supabase = getSupabaseAdminClient();
        const { data, error } = await supabase
          .from('documents')
          .select('*, employees (full_name, employee_id)')
          .ilike('verification_id', vId.trim())
          .maybeSingle();

        if (error) handleDbError('documents.getByVerificationId', error);
        return data ? mapSupabaseDocument(data) : null;
      }
      return localDb.getState().documents.find((d) => d.verification_id.toUpperCase() === vId.toUpperCase()) || null;
    },

    async create(data: {
      document_type: DocumentType;
      employee_id: string;
      title: string;
      data_snapshot: Record<string, any>;
      created_by: string;
      created_by_name: string;
      status?: DocumentWorkflowStatus;
    }): Promise<DocumentRecord> {
      if (isSupabaseMode()) {
        assertDatastoreMode();
        const supabase = getSupabaseAdminClient();
        const emp = await db.employees.getById(data.employee_id);
        if (!emp) throw new Error('Associated employee record not found.');

        if (emp.status === 'INACTIVE' || emp.status === 'SEPARATED' || emp.deletion_status === 'DELETED') {
          throw new Error(`DOCUMENT GENERATION BLOCKED: Cannot generate new ${data.document_type} for an inactive or separated employee (${emp.full_name}, ${emp.employee_id}). Historical documents remain preserved under legal audit retention.`);
        }

        // High-assurance unique sequential document number generation
        // 0. Attempt authoritative database-backed sequence if migration is installed
        let candidateSeq: number | null = null;
        try {
          const { data: dbSeq, error: rpcError } = await supabase.rpc('next_document_sequence', {
            p_document_type: data.document_type,
          });
          if (!rpcError && typeof dbSeq === 'number' && dbSeq > 1000) {
            candidateSeq = dbSeq;
          } else if (rpcError) {
            const isFunctionNotFound =
              rpcError.code === 'PGRST202' ||
              rpcError.message?.includes('Could not find the function') ||
              rpcError.message?.includes('function public.next_document_sequence') ||
              rpcError.code === '42883';

            if (!isFunctionNotFound) {
              // The database function exists but threw an error (e.g. invalid type or internal error).
              // Do NOT silently fall back to the scanner in production!
              throw new Error(`Authoritative sequence allocation failed: ${rpcError.message}`);
            }
          }
        } catch (e: any) {
          if (e.message?.startsWith('Authoritative sequence allocation failed')) {
            throw e;
          }
          // Only fall back to scanner when function is missing (e.g. local dev prior to migration)
        }

        // 1. Fallback to scanning existing document numbers if DB sequence function is not installed (local dev)
        if (!candidateSeq) {
          const { data: existingDocs } = await supabase
            .from('documents')
            .select('document_number')
            .eq('document_type', data.document_type);

          const extractedSeqs = (existingDocs || []).map((row: { document_number?: string }) => {
            const match = (row.document_number || '').match(/-(\d+)$/);
            return match ? parseInt(match[1], 10) : 0;
          });
          const highestExistingSeq = Math.max(1000, ...extractedSeqs);

          // 2. In-process sequence reservation to prevent simultaneous generation races
          const reservedInProcess = inMemoryDocSeq.get(data.document_type) || 1000;
          candidateSeq = Math.max(highestExistingSeq, reservedInProcess) + 1;
          inMemoryDocSeq.set(data.document_type, candidateSeq);
        }

        // Retrieve active branding settings to freeze in snapshot if not provided
        const snapshot = { ...(data.data_snapshot || {}) };
        try {
          const brandingRaw = await db.systemSettings.get('document_branding');
          if (brandingRaw) {
            if (!snapshot.signatory && brandingRaw.signatory?.is_active) {
              snapshot.signatory = {
                name: brandingRaw.signatory.name,
                title: brandingRaw.signatory.title,
                department: brandingRaw.signatory.department,
                company: brandingRaw.signatory.company,
                signature_url: brandingRaw.signatory.signature_url,
                version: brandingRaw.signatory.version,
              };
            }
            if (!snapshot.stamp && brandingRaw.stamp?.is_active) {
              snapshot.stamp = {
                stamp_url: brandingRaw.stamp.stamp_url,
                version: brandingRaw.stamp.version,
              };
            }
          }
        } catch (e) {
          console.warn('Failed to retrieve branding settings for snapshot:', e);
        }

        // 3. Optimistic concurrency retry loop (guarantees collision-free insert)
        let insertedRow = null;
        let lastError: any = null;
        const maxAttempts = 10;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const document_number = formatDocumentNumber(data.document_type, candidateSeq);
          const verification_id = generateVerificationId(data.document_type);

          const insertPayload: any = {
            document_number,
            verification_id,
            document_type: data.document_type,
            employee_id: emp.id,
            template_version: 'v1.0',
            title: data.title,
            status: data.status || 'PENDING_APPROVAL',
            issue_date: new Date().toISOString().split('T')[0],
            data_snapshot: snapshot,
            created_by: isUuid(data.created_by) ? data.created_by : null,
            version_number: 1,
          };

          const { data: inserted, error } = await supabase
            .from('documents')
            .insert(insertPayload)
            .select('*, employees (full_name, employee_id)')
            .single();

          if (!error && inserted) {
            insertedRow = inserted;
            inMemoryDocSeq.set(data.document_type, candidateSeq);
            break;
          }

          if (error) {
            const isUniqueConstraintViolation =
              error.code === '23505' ||
              error.message?.includes('documents_document_number_key') ||
              error.message?.includes('duplicate key value') ||
              error.message?.includes('unique constraint');

            if (isUniqueConstraintViolation) {
              candidateSeq++;
              inMemoryDocSeq.set(data.document_type, candidateSeq);
              lastError = error;
              continue;
            }

            handleDbError('documents.create', error);
          }
        }

        if (!insertedRow) {
          handleDbError('documents.create (collision)', lastError);
        }

        const result = mapSupabaseDocument(insertedRow);
        result.created_by_name = data.created_by_name;
        return result;
      }

      const state = localDb.getState();
      const emp = state.employees.find((e) => e.id === data.employee_id);
      if (!emp) throw new Error('Associated employee record not found.');

      if (emp.status === 'INACTIVE' || emp.status === 'SEPARATED' || emp.deletion_status === 'DELETED') {
        throw new Error(`DOCUMENT GENERATION BLOCKED: Cannot generate new ${data.document_type} for an inactive or separated employee (${emp.full_name}, ${emp.employee_id}). Historical documents remain preserved under legal audit retention.`);
      }

      const document_number = localDb.getNextDocumentNumber(data.document_type);
      const verification_id = generateVerificationId(data.document_type);

      const snapshot = { ...(data.data_snapshot || {}) };
      const brandingRaw = await db.systemSettings.get('document_branding');
      if (brandingRaw) {
        if (!snapshot.signatory && brandingRaw.signatory?.is_active) {
          snapshot.signatory = {
            name: brandingRaw.signatory.name,
            title: brandingRaw.signatory.title,
            department: brandingRaw.signatory.department,
            company: brandingRaw.signatory.company,
            signature_url: brandingRaw.signatory.signature_url,
            version: brandingRaw.signatory.version,
          };
        }
        if (!snapshot.stamp && brandingRaw.stamp?.is_active) {
          snapshot.stamp = {
            stamp_url: brandingRaw.stamp.stamp_url,
            version: brandingRaw.stamp.version,
          };
        }
      }

      const doc: DocumentRecord = {
        id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        document_number,
        verification_id,
        document_type: data.document_type,
        employee_id: emp.id,
        employee_name: emp.full_name,
        employee_code: emp.employee_id,
        template_version: 'v1.0',
        title: data.title,
        status: data.status || 'PENDING_APPROVAL',
        issue_date: new Date().toISOString().split('T')[0],
        data_snapshot: snapshot,
        created_by: data.created_by,
        created_by_name: data.created_by_name,
        version_number: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      state.documents.unshift(doc);
      localDb.save();
      return doc;
    },

    async approve(id: string, approverId: string, approverName: string): Promise<DocumentRecord> {
      if (isSupabaseMode()) {
        assertDatastoreMode();
        const supabase = getSupabaseAdminClient();
        const existing = await db.documents.getById(id);
        if (!existing) throw new Error('Document not found');
        if (existing.status === 'REVOKED') throw new Error('Revoked document cannot be approved.');

        const updatePayload: any = {
          status: 'APPROVED',
          approved_by: isUuid(approverId) ? approverId : null,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (!existing.data_snapshot?.signatory || !existing.data_snapshot?.stamp) {
          try {
            const brandingRaw = await db.systemSettings.get('document_branding');
            if (brandingRaw) {
              const currentSnapshot = { ...(existing.data_snapshot || {}) };
              let changed = false;
              if (!currentSnapshot.signatory && brandingRaw.signatory?.is_active) {
                currentSnapshot.signatory = {
                  name: brandingRaw.signatory.name,
                  title: brandingRaw.signatory.title,
                  department: brandingRaw.signatory.department,
                  company: brandingRaw.signatory.company,
                  signature_url: brandingRaw.signatory.signature_url,
                  version: brandingRaw.signatory.version,
                };
                changed = true;
              }
              if (!currentSnapshot.stamp && brandingRaw.stamp?.is_active) {
                currentSnapshot.stamp = {
                  stamp_url: brandingRaw.stamp.stamp_url,
                  version: brandingRaw.stamp.version,
                };
                changed = true;
              }
              if (changed) {
                updatePayload.data_snapshot = currentSnapshot;
              }
            }
          } catch (e) {
            console.warn('Failed to freeze branding in snapshot on approve:', e);
          }
        }

        const { data: updated, error } = await supabase
          .from('documents')
          .update(updatePayload)
          .eq('id', existing.id)
          .select('*, employees (full_name, employee_id)')
          .single();

        if (error) handleDbError('documents.approve', error);
        const result = mapSupabaseDocument(updated);
        result.approved_by_name = approverName;
        return result;
      }

      const state = localDb.getState();
      const doc = state.documents.find((d) => d.id === id);
      if (!doc) throw new Error('Document not found');
      if (doc.status === 'REVOKED') throw new Error('Revoked document cannot be approved.');

      if (!doc.data_snapshot?.signatory || !doc.data_snapshot?.stamp) {
        const brandingRaw = await db.systemSettings.get('document_branding');
        if (brandingRaw) {
          if (!doc.data_snapshot.signatory && brandingRaw.signatory?.is_active) {
            doc.data_snapshot.signatory = {
              name: brandingRaw.signatory.name,
              title: brandingRaw.signatory.title,
              department: brandingRaw.signatory.department,
              company: brandingRaw.signatory.company,
              signature_url: brandingRaw.signatory.signature_url,
              version: brandingRaw.signatory.version,
            };
          }
          if (!doc.data_snapshot.stamp && brandingRaw.stamp?.is_active) {
            doc.data_snapshot.stamp = {
              stamp_url: brandingRaw.stamp.stamp_url,
              version: brandingRaw.stamp.version,
            };
          }
        }
      }

      doc.status = 'APPROVED';
      doc.approved_by = approverId;
      doc.approved_by_name = approverName;
      doc.approved_at = new Date().toISOString();
      doc.updated_at = new Date().toISOString();

      localDb.save();
      return doc;
    },

    async reject(id: string, reviewerId: string, reviewerName: string, reason: string): Promise<DocumentRecord> {
      if (isSupabaseMode()) {
        assertDatastoreMode();
        const supabase = getSupabaseAdminClient();
        const existing = await db.documents.getById(id);
        if (!existing) throw new Error('Document not found');

        const { data: updated, error } = await supabase
          .from('documents')
          .update({
            status: 'REJECTED',
            revocation_reason: reason,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select('*, employees (full_name, employee_id)')
          .single();

        if (error) handleDbError('documents.reject', error);
        return mapSupabaseDocument(updated);
      }

      const state = localDb.getState();
      const doc = state.documents.find((d) => d.id === id);
      if (!doc) throw new Error('Document not found');

      doc.status = 'REJECTED';
      doc.revocation_reason = reason;
      doc.updated_at = new Date().toISOString();

      localDb.save();
      return doc;
    },

    async revoke(id: string, revokerId: string, revokerName: string, reason: string): Promise<DocumentRecord> {
      if (!reason || reason.trim().length < 5) {
        throw new Error('Revocation requires a detailed, valid business reason.');
      }

      if (isSupabaseMode()) {
        assertDatastoreMode();
        const supabase = getSupabaseAdminClient();
        const existing = await db.documents.getById(id);
        if (!existing) throw new Error('Document not found');

        const { data: updated, error } = await supabase
          .from('documents')
          .update({
            status: 'REVOKED',
            revoked_by: isUuid(revokerId) ? revokerId : null,
            revoked_at: new Date().toISOString(),
            revocation_reason: reason,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select('*, employees (full_name, employee_id)')
          .single();

        if (error) handleDbError('documents.revoke', error);
        const result = mapSupabaseDocument(updated);
        result.revoked_by_name = revokerName;
        return result;
      }

      const state = localDb.getState();
      const doc = state.documents.find((d) => d.id === id);
      if (!doc) throw new Error('Document not found');

      doc.status = 'REVOKED';
      doc.revoked_by = revokerId;
      doc.revoked_by_name = revokerName;
      doc.revoked_at = new Date().toISOString();
      doc.revocation_reason = reason;
      doc.updated_at = new Date().toISOString();

      localDb.save();
      return doc;
    },

    async createNewVersion(
      docId: string,
      newDataSnapshot: Record<string, any>,
      reason: string,
      userId: string,
      userName: string
    ): Promise<DocumentRecord> {
      if (isSupabaseMode()) {
        assertDatastoreMode();
        const supabase = getSupabaseAdminClient();
        const existing = await db.documents.getById(docId);
        if (!existing) throw new Error('Original document not found');

        // Archive previous version to document_versions table (audit preservation)
        await supabase.from('document_versions').insert({
          document_id: existing.id,
          version_number: existing.version_number,
          document_number: existing.document_number,
          verification_id: existing.verification_id,
          status: existing.status,
          file_path: existing.file_path || null,
          data_snapshot: existing.data_snapshot,
          change_reason: reason,
          created_by: isUuid(userId) ? userId : null,
        });

        const newVersionNum = existing.version_number + 1;
        const newDocNumber = `${existing.document_number.split('-v')[0]}-v${newVersionNum}`;
        const newVerificationId = generateVerificationId(existing.document_type);

        const { data: newDoc, error } = await supabase
          .from('documents')
          .insert({
            document_number: newDocNumber,
            verification_id: newVerificationId,
            document_type: existing.document_type,
            employee_id: existing.employee_id,
            template_id: existing.template_id || null,
            template_version: existing.template_version,
            title: existing.title,
            status: 'PENDING_APPROVAL',
            issue_date: new Date().toISOString().split('T')[0],
            data_snapshot: newDataSnapshot,
            created_by: isUuid(userId) ? userId : null,
            version_number: newVersionNum,
          })
          .select('*, employees (full_name, employee_id)')
          .single();

        if (error) handleDbError('documents.createNewVersion', error);
        const result = mapSupabaseDocument(newDoc);
        result.created_by_name = userName;
        return result;
      }

      const state = localDb.getState();
      const existing = state.documents.find((d) => d.id === docId);
      if (!existing) throw new Error('Original document not found');

      const newVersionNum = existing.version_number + 1;
      const newDocNumber = `${existing.document_number.split('-v')[0]}-v${newVersionNum}`;
      const newVerificationId = generateVerificationId(existing.document_type);

      const newDoc: DocumentRecord = {
        ...existing,
        id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        document_number: newDocNumber,
        verification_id: newVerificationId,
        version_number: newVersionNum,
        status: 'PENDING_APPROVAL',
        data_snapshot: newDataSnapshot,
        created_by: userId,
        created_by_name: userName,
        approved_by: undefined,
        approved_by_name: undefined,
        approved_at: undefined,
        revoked_by: undefined,
        revoked_by_name: undefined,
        revoked_at: undefined,
        revocation_reason: undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      state.documents.unshift(newDoc);
      localDb.save();
      return newDoc;
    },

    async delete(
      id: string,
      actorId: string,
      actorEmail: string,
      reason: string
    ): Promise<{ success: boolean; action: 'DELETED' | 'REVOKED' | 'ALREADY_REVOKED'; document: DocumentRecord }> {
      assertDatastoreMode();
      if (!reason || typeof reason !== 'string' || !reason.trim()) {
        throw new Error('A mandatory deletion reason is required.');
      }

      const cleanReason = reason.trim();
      const existing = await this.getById(id);
      if (!existing) {
        throw new Error('Document not found');
      }

      const now = new Date().toISOString();

      // Protected lifecycle rule:
      // If document is APPROVED or FINAL, it is legally/audit-relevant.
      // Soft-delete / transition to REVOKED to preserve audit trail and verification honesty.
      if (existing.status === 'APPROVED' || (existing.status as string) === 'FINAL') {
        const revokedDoc = await this.revoke(existing.id, actorId, actorEmail, cleanReason);

        await logAuditEvent({
          userId: actorId,
          userEmail: actorEmail,
          action: 'DOCUMENT_REVOKED',
          resourceType: 'DOCUMENT',
          resourceId: existing.document_number,
          reason: cleanReason,
          metadata: {
            document_id: existing.id,
            document_number: existing.document_number,
            document_type: existing.document_type,
            employee_name: existing.employee_name,
            employee_code: existing.employee_code,
            previous_status: existing.status,
            new_status: 'REVOKED',
            deletion_reason: cleanReason,
            action_type: 'SOFT_DELETE_REVOCATION',
            timestamp: now,
          },
        });

        return { success: true, action: 'REVOKED', document: revokedDoc };
      }

      if (existing.status === 'REVOKED') {
        return { success: true, action: 'ALREADY_REVOKED', document: existing };
      }

      // Pre-approval / working / unapproved draft states:
      // DRAFT, PREVIEW, VALIDATE, GENERATE, PENDING_APPROVAL, REJECTED
      // Physical deletion from documents registry, with permanent audit trail
      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();

        // Unlink any tasks referencing this document
        try {
          await supabase.from('tasks').update({ document_id: null }).eq('document_id', existing.id);
        } catch {
          // Non-fatal if tasks table doesn't have document_id
        }

        // Delete version records if any
        try {
          await supabase.from('document_versions').delete().eq('document_id', existing.id);
        } catch {
          // Cascaded or not present
        }

        const { error } = await supabase.from('documents').delete().eq('id', existing.id);
        if (error) {
          handleDbError('documents.delete', error);
        }
      } else {
        const state = localDb.getState();
        const idx = state.documents.findIndex((d) => d.id === existing.id || d.document_number === existing.document_number);
        if (idx >= 0) {
          state.documents.splice(idx, 1);
          localDb.save();
        }
      }

      // Permanent immutable audit entry
      await logAuditEvent({
        userId: actorId,
        userEmail: actorEmail,
        action: 'DOCUMENT_DELETED',
        resourceType: 'DOCUMENT',
        resourceId: existing.document_number,
        reason: cleanReason,
        metadata: {
          document_id: existing.id,
          document_number: existing.document_number,
          document_type: existing.document_type,
          employee_name: existing.employee_name,
          employee_code: existing.employee_code,
          previous_status: existing.status,
          deletion_reason: cleanReason,
          action_type: 'PHYSICAL_DELETION',
          timestamp: now,
        },
      });

      return { success: true, action: 'DELETED', document: existing };
    }
  },

  templates: {
    async list(): Promise<TemplateRecord[]> {
      if (isSupabaseMode()) {
        assertDatastoreMode();
        const supabase = getSupabaseAdminClient();
        const { data, error } = await supabase.from('templates').select('*').order('name');
        if (error) handleDbError('templates.list', error);
        return (data || []).map(mapSupabaseTemplate);
      }
      return localDb.getState().templates;
    },

    async getById(id: string): Promise<TemplateRecord | null> {
      if (isSupabaseMode()) {
        assertDatastoreMode();
        const supabase = getSupabaseAdminClient();
        const query = isUuid(id)
          ? supabase.from('templates').select('*').or(`id.eq.${id},template_code.eq.${id}`).maybeSingle()
          : supabase.from('templates').select('*').eq('template_code', id).maybeSingle();

        const { data, error } = await query;
        if (error) handleDbError('templates.getById', error);
        return data ? mapSupabaseTemplate(data) : null;
      }
      return localDb.getState().templates.find((t) => t.id === id || t.template_code === id) || null;
    }
  },

  verification: {
    async verifyPublic(verificationId: string, ip?: string, userAgent?: string): Promise<PublicVerificationResult> {
      const cleanVId = verificationId.trim();

      if (isSupabaseMode()) {
        assertDatastoreMode();
        const supabase = getSupabaseAdminClient();
        const { data: doc } = await supabase
          .from('documents')
          .select('*, employees (full_name, employee_id)')
          .ilike('verification_id', cleanVId)
          .maybeSingle();

        let resultStatus: PublicVerificationStatus;
        if (!doc) {
          resultStatus = 'NOT_FOUND';
        } else if (doc.status === 'REVOKED') {
          resultStatus = 'REVOKED';
        } else if (doc.status === 'REJECTED') {
          resultStatus = 'REJECTED';
        } else if (doc.status === 'PENDING_APPROVAL' || doc.status === 'DRAFT' || doc.status === 'PREVIEW' || doc.status === 'VALIDATE' || doc.status === 'GENERATE') {
          resultStatus = 'PENDING_APPROVAL';
        } else if (doc.status === 'APPROVED' || doc.status === 'FINAL') {
          resultStatus = 'VALID';
        } else {
          resultStatus = 'PENDING_APPROVAL';
        }

        // Log public verification event safely to Supabase telemetry table
        try {
          await supabase.from('verification_logs').insert({
            verification_id: cleanVId,
            document_id: doc?.id || null,
            status_result: resultStatus,
            ip_address: ip || '127.0.0.1',
            user_agent: userAgent || 'Public-Browser',
          });
        } catch (logErr) {
          console.error('Failed to log verification event to Supabase:', logErr);
        }

        if (!doc || resultStatus === 'NOT_FOUND') {
          return {
            status: 'NOT_FOUND',
            verification_id: cleanVId,
            verified_at: new Date().toISOString(),
          };
        }

        const employeeName = doc.employees?.full_name || doc.data_snapshot?.candidateName || doc.data_snapshot?.employeeName;
        const employeeCode = doc.employees?.employee_id || doc.data_snapshot?.employeeCode;

        if (resultStatus === 'REVOKED') {
          return {
            status: 'REVOKED',
            document_workflow_status: doc.status,
            verification_id: doc.verification_id,
            document_number: doc.document_number,
            document_type: doc.document_type as DocumentType,
            document_title: doc.title,
            candidate_name: employeeName,
            employee_id: employeeCode,
            issue_date: doc.issue_date,
            revoked_at: doc.revoked_at,
            revocation_reason: doc.revocation_reason,
            verified_at: new Date().toISOString(),
          };
        }

        if (resultStatus === 'REJECTED') {
          return {
            status: 'REJECTED',
            document_workflow_status: doc.status,
            verification_id: doc.verification_id,
            document_number: doc.document_number,
            document_type: doc.document_type as DocumentType,
            document_title: doc.title,
            candidate_name: employeeName,
            employee_id: employeeCode,
            issue_date: doc.issue_date,
            rejection_reason: doc.data_snapshot?.rejection_reason || 'Document was rejected during approval review.',
            verified_at: new Date().toISOString(),
          };
        }

        if (resultStatus === 'PENDING_APPROVAL') {
          return {
            status: 'PENDING_APPROVAL',
            document_workflow_status: doc.status,
            verification_id: doc.verification_id,
            document_number: doc.document_number,
            document_type: doc.document_type as DocumentType,
            document_title: doc.title,
            candidate_name: employeeName,
            employee_id: employeeCode,
            issue_date: doc.issue_date,
            verified_at: new Date().toISOString(),
          };
        }

        return {
          status: 'VALID',
          document_workflow_status: doc.status,
          verification_id: doc.verification_id,
          document_number: doc.document_number,
          document_type: doc.document_type as DocumentType,
          document_title: doc.title,
          candidate_name: employeeName,
          employee_id: employeeCode,
          issue_date: doc.issue_date,
          authorized_signatory: 'Authorized Signatory, Varsaka Labs',
          verified_at: new Date().toISOString(),
        };
      }

      // Local fallback
      const state = localDb.getState();
      const doc = state.documents.find((d) => d.verification_id.toUpperCase() === cleanVId.toUpperCase());

      let resultStatus: PublicVerificationStatus;
      if (!doc) {
        resultStatus = 'NOT_FOUND';
      } else if (doc.status === 'REVOKED') {
        resultStatus = 'REVOKED';
      } else if (doc.status === 'REJECTED') {
        resultStatus = 'REJECTED';
      } else if (doc.status === 'PENDING_APPROVAL' || doc.status === 'DRAFT' || doc.status === 'PREVIEW' || doc.status === 'VALIDATE' || doc.status === 'GENERATE') {
        resultStatus = 'PENDING_APPROVAL';
      } else if (doc.status === 'APPROVED' || doc.status === 'FINAL') {
        resultStatus = 'VALID';
      } else {
        resultStatus = 'PENDING_APPROVAL';
      }

      state.verification_logs.unshift({
        id: `vlog-${Date.now()}`,
        verification_id: cleanVId,
        document_id: doc?.id,
        status_result: resultStatus,
        ip_address: ip || '127.0.0.1',
        user_agent: userAgent || 'Public-Browser',
        verified_at: new Date().toISOString(),
      });
      if (process.env.STORAGE_MODE !== 'supabase' && process.env.NODE_ENV !== 'production') {
        localDb.save();
      }

      if (!doc || resultStatus === 'NOT_FOUND') {
        return {
          status: 'NOT_FOUND',
          verification_id: cleanVId,
          verified_at: new Date().toISOString(),
        };
      }

      if (resultStatus === 'REVOKED') {
        return {
          status: 'REVOKED',
          document_workflow_status: doc.status,
          verification_id: doc.verification_id,
          document_number: doc.document_number,
          document_type: doc.document_type,
          document_title: doc.title,
          candidate_name: doc.employee_name,
          employee_id: doc.employee_code,
          issue_date: doc.issue_date,
          revoked_at: doc.revoked_at,
          revocation_reason: doc.revocation_reason,
          verified_at: new Date().toISOString(),
        };
      }

      if (resultStatus === 'REJECTED') {
        return {
          status: 'REJECTED',
          document_workflow_status: doc.status,
          verification_id: doc.verification_id,
          document_number: doc.document_number,
          document_type: doc.document_type,
          document_title: doc.title,
          candidate_name: doc.employee_name,
          employee_id: doc.employee_code,
          issue_date: doc.issue_date,
          rejection_reason: doc.data_snapshot?.rejection_reason || 'Document was rejected during approval review.',
          verified_at: new Date().toISOString(),
        };
      }

      if (resultStatus === 'PENDING_APPROVAL') {
        return {
          status: 'PENDING_APPROVAL',
          document_workflow_status: doc.status,
          verification_id: doc.verification_id,
          document_number: doc.document_number,
          document_type: doc.document_type,
          document_title: doc.title,
          candidate_name: doc.employee_name,
          employee_id: doc.employee_code,
          issue_date: doc.issue_date,
          verified_at: new Date().toISOString(),
        };
      }

      return {
        status: 'VALID',
        document_workflow_status: doc.status,
        verification_id: doc.verification_id,
        document_number: doc.document_number,
        document_type: doc.document_type,
        document_title: doc.title,
        candidate_name: doc.employee_name,
        employee_id: doc.employee_code,
        issue_date: doc.issue_date,
        authorized_signatory: 'Authorized Signatory, Varsaka Labs',
        verified_at: new Date().toISOString(),
      };
    }
  },

  auditLogs: {
    async list(limitOrFilters?: number | { action?: string; limit?: number }): Promise<AuditLog[]> {
      let limit = 100;
      let actionFilter: string | undefined;
      if (typeof limitOrFilters === 'number') {
        limit = limitOrFilters;
      } else if (limitOrFilters && typeof limitOrFilters === 'object') {
        if (typeof limitOrFilters.limit === 'number') limit = limitOrFilters.limit;
        if (limitOrFilters.action) actionFilter = limitOrFilters.action;
      }

      if (isSupabaseMode()) {
        assertDatastoreMode();
        const supabase = getSupabaseAdminClient();
        let query = supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (actionFilter) {
          query = query.eq('action', actionFilter);
        }

        const { data, error } = await query;
        if (error) handleDbError('auditLogs.list', error);
        return data || [];
      }

      let logs = localDb.getState().audit_logs;
      if (actionFilter) {
        logs = logs.filter((l) => l.action === actionFilter);
      }
      return logs.slice(0, limit);
    },

    async purgeExpired(retentionDays: number = 7): Promise<{ deletedCount: number; cutoff: string }> {
      assertDatastoreMode();
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        const { error, count } = await supabase
          .from('audit_logs')
          .delete({ count: 'exact' })
          .lt('created_at', cutoff);

        if (error) handleDbError('auditLogs.purgeExpired', error);
        return { deletedCount: count || 0, cutoff };
      }

      const state = localDb.getState();
      const initialCount = state.audit_logs.length;
      state.audit_logs = state.audit_logs.filter(
        (l) => new Date(l.created_at).getTime() >= new Date(cutoff).getTime()
      );
      localDb.save();
      return { deletedCount: initialCount - state.audit_logs.length, cutoff };
    }
  },

  securityLogs: {
    async list(limit: number = 100): Promise<SecurityLog[]> {
      if (isSupabaseMode()) {
        assertDatastoreMode();
        const supabase = getSupabaseAdminClient();
        const { data, error } = await supabase
          .from('security_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) handleDbError('securityLogs.list', error);
        return data || [];
      }
      return localDb.getState().security_logs.slice(0, limit);
    },

    async purgeExpired(retentionDays: number = 7): Promise<{ deletedCount: number; cutoff: string }> {
      assertDatastoreMode();
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        const { error, count } = await supabase
          .from('security_logs')
          .delete({ count: 'exact' })
          .lt('created_at', cutoff);

        if (error) handleDbError('securityLogs.purgeExpired', error);
        return { deletedCount: count || 0, cutoff };
      }

      const state = localDb.getState();
      const initialCount = state.security_logs.length;
      state.security_logs = state.security_logs.filter(
        (l) => new Date(l.created_at).getTime() >= new Date(cutoff).getTime()
      );
      localDb.save();
      return { deletedCount: initialCount - state.security_logs.length, cutoff };
    }
  },

  logRetention: {
    /**
     * Executes the rolling 7-day retention policy on public.audit_logs and public.security_logs.
     * Enforces an atomic database-backed 20-hour throttle using PostgreSQL row-level locking
     * on public.system_settings('log_retention_status').
     *
     * Retention period is immutably fixed to 7 days.
     * Only accepts an optional internal test override flag: { forceInternalTest?: boolean }
     */
    async executePolicy(options?: { forceInternalTest?: boolean }): Promise<{
      skipped: boolean;
      reason?: string;
      last_executed_at: string;
      retention_days: number;
      cutoff_used: string;
      audit_logs_purged: number;
      security_logs_purged: number;
      auditLogsDeleted: number;
      securityLogsDeleted: number;
      cutoff: string;
      executedAt: string;
    }> {
      assertDatastoreMode();
      // Retention period is strictly and immutably 7 days
      const retentionDays = 7;
      const forceInternalTest = Boolean(options?.forceInternalTest);

      const THROTTLE_HOURS = 20;
      const THROTTLE_MS = THROTTLE_HOURS * 60 * 60 * 1000;
      const now = new Date();
      const nowMs = now.getTime();
      const nowIso = now.toISOString();
      const cutoff20h = new Date(nowMs - THROTTLE_MS).toISOString();
      const cutoff7d = new Date(nowMs - retentionDays * 24 * 60 * 60 * 1000).toISOString();

      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();

        // 1. Ensure initial status row exists in public.system_settings
        const { data: existingRow } = await supabase
          .from('system_settings')
          .select('key, value, updated_at')
          .eq('key', 'log_retention_status')
          .maybeSingle();

        if (!existingRow) {
          const pastTime = new Date(nowMs - 25 * 3600 * 1000).toISOString();
          await supabase.from('system_settings').insert({
            key: 'log_retention_status',
            value: {
              last_executed_at: pastTime,
              retention_days: retentionDays,
              cutoff_used: cutoff7d,
              audit_logs_purged: 0,
              security_logs_purged: 0,
            },
            description: 'Rolling 7-day log retention execution telemetry',
            updated_at: pastTime,
          });
        }

        // 2. ATOMIC DATABASE CLAIM:
        // Conditional UPDATE on public.system_settings with updated_at < cutoff20h.
        // PostgreSQL's tuple lock and MVCC guarantee that under concurrency,
        // exactly ONE transaction updates the row and receives data.length === 1.
        // All concurrent requests re-evaluate the condition, fail it, and receive data.length === 0.
        let claimQuery = supabase
          .from('system_settings')
          .update({
            updated_at: nowIso,
            description: 'Rolling 7-day log retention execution telemetry',
          })
          .eq('key', 'log_retention_status');

        if (!forceInternalTest) {
          claimQuery = claimQuery.lt('updated_at', cutoff20h);
        }

        const { data: claimData, error: claimErr } = await claimQuery.select('key, value, updated_at');
        if (claimErr) {
          handleDbError('logRetention.atomicClaim', claimErr);
        }

        if (!claimData || claimData.length === 0) {
          // Throttled: Another request already claimed or ran retention within this 20-hour window
          const currentMeta = (existingRow?.value as any) || {};
          const lastRun = existingRow?.updated_at || currentMeta.last_executed_at || nowIso;
          const elapsed = ((nowMs - new Date(lastRun).getTime()) / (60 * 60 * 1000)).toFixed(1);
          const remaining = (THROTTLE_HOURS - parseFloat(elapsed)).toFixed(1);

          console.log(
            `[LOG RETENTION] Throttled: Retention policy executed ${elapsed}h ago (< 20h throttle window). ` +
            `Next execution available in ${remaining}h.`
          );

          return {
            skipped: true,
            reason: `Throttled: Last execution was ${elapsed}h ago (< 20h throttle window)`,
            last_executed_at: currentMeta.last_executed_at || lastRun,
            retention_days: retentionDays,
            cutoff_used: currentMeta.cutoff_used || cutoff7d,
            audit_logs_purged: 0,
            security_logs_purged: 0,
            auditLogsDeleted: 0,
            securityLogsDeleted: 0,
            cutoff: currentMeta.cutoff_used || cutoff7d,
            executedAt: currentMeta.last_executed_at || lastRun,
          };
        }

        // 3. CLAIM GRANTED: We exclusively own this execution cycle
        // Purge expired records from audit_logs and security_logs ONLY
        const auditResult = await db.auditLogs.purgeExpired(retentionDays);
        const securityResult = await db.securityLogs.purgeExpired(retentionDays);

        const statusMetadata = {
          last_executed_at: nowIso,
          retention_days: retentionDays,
          cutoff_used: cutoff7d,
          audit_logs_purged: auditResult.deletedCount,
          security_logs_purged: securityResult.deletedCount,
        };

        await supabase
          .from('system_settings')
          .update({ value: statusMetadata })
          .eq('key', 'log_retention_status');

        console.log(
          `[LOG RETENTION] 7-Day Rolling Retention executed at ${nowIso}: ` +
          `Purged ${auditResult.deletedCount} audit_logs, ${securityResult.deletedCount} security_logs ` +
          `(Cutoff: ${cutoff7d}). Strictly preserved all active business records.`
        );

        return {
          skipped: false,
          last_executed_at: nowIso,
          retention_days: retentionDays,
          cutoff_used: cutoff7d,
          audit_logs_purged: auditResult.deletedCount,
          security_logs_purged: securityResult.deletedCount,
          auditLogsDeleted: auditResult.deletedCount,
          securityLogsDeleted: securityResult.deletedCount,
          cutoff: cutoff7d,
          executedAt: nowIso,
        };
      }

      // Local / Mock Mode Fallback
      const existingStatus = await db.systemSettings.get<{
        last_executed_at: string;
        retention_days: number;
        cutoff_used: string;
        audit_logs_purged: number;
        security_logs_purged: number;
      }>('log_retention_status');

      if (!forceInternalTest && existingStatus?.last_executed_at) {
        const lastRunMs = new Date(existingStatus.last_executed_at).getTime();
        const diffMs = nowMs - lastRunMs;
        if (diffMs >= 0 && diffMs < THROTTLE_MS) {
          const elapsed = (diffMs / (60 * 60 * 1000)).toFixed(1);
          return {
            skipped: true,
            reason: `Throttled: Last execution was ${elapsed}h ago (< 20h throttle window)`,
            last_executed_at: existingStatus.last_executed_at,
            retention_days: retentionDays,
            cutoff_used: existingStatus.cutoff_used || cutoff7d,
            audit_logs_purged: 0,
            security_logs_purged: 0,
            auditLogsDeleted: 0,
            securityLogsDeleted: 0,
            cutoff: existingStatus.cutoff_used || cutoff7d,
            executedAt: existingStatus.last_executed_at,
          };
        }
      }

      const auditResult = await db.auditLogs.purgeExpired(retentionDays);
      const securityResult = await db.securityLogs.purgeExpired(retentionDays);

      const statusMetadata = {
        last_executed_at: nowIso,
        retention_days: retentionDays,
        cutoff_used: cutoff7d,
        audit_logs_purged: auditResult.deletedCount,
        security_logs_purged: securityResult.deletedCount,
      };

      await db.systemSettings.set(
        'log_retention_status',
        statusMetadata,
        'Rolling 7-day log retention execution telemetry'
      );

      return {
        skipped: false,
        last_executed_at: nowIso,
        retention_days: retentionDays,
        cutoff_used: cutoff7d,
        audit_logs_purged: auditResult.deletedCount,
        security_logs_purged: securityResult.deletedCount,
        auditLogsDeleted: auditResult.deletedCount,
        securityLogsDeleted: securityResult.deletedCount,
        cutoff: cutoff7d,
        executedAt: nowIso,
      };
    },

    async getStatus(): Promise<{
      last_executed_at: string;
      retention_days: number;
      cutoff_used: string;
      audit_logs_purged: number;
      security_logs_purged: number;
    } | null> {
      assertDatastoreMode();
      return await db.systemSettings.get('log_retention_status');
    }
  },

  systemSettings: {
    async get<T = any>(key: string): Promise<T | null> {
      if (isSupabaseMode()) {
        assertDatastoreMode();
        const supabase = getSupabaseAdminClient();
        const { data, error } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', key)
          .maybeSingle();

        if (error) handleDbError('systemSettings.get', error);
        return (data?.value as T) || null;
      }
      return (localSettingsStore[key] as T) || null;
    },

    async set(key: string, value: any, description?: string): Promise<void> {
      if (isSupabaseMode()) {
        assertDatastoreMode();
        const supabase = getSupabaseAdminClient();
        const { error } = await supabase
          .from('system_settings')
          .upsert({
            key,
            value,
            description: description || null,
            updated_at: new Date().toISOString(),
          });

        if (error) handleDbError('systemSettings.set', error);
        return;
      }
      localSettingsStore[key] = value;
    }
  },

  tasks: {
    async list(filters?: {
      assigned_to?: string;
      created_by?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      search?: string;
    }): Promise<TaskRecord[]> {
      assertDatastoreMode();
      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        try {
          let query = supabase
            .from('tasks')
            .select(`
              *,
              assigned_user:users!tasks_assigned_to_fkey(id, full_name, email),
              created_user:users!tasks_created_by_fkey(id, full_name, email),
              employee:employees(id, full_name, employee_id),
              document:documents(id, document_number, title)
            `)
            .order('created_at', { ascending: false });

          if (filters?.assigned_to) {
            query = query.eq('assigned_to', filters.assigned_to);
          }
          if (filters?.created_by) {
            query = query.eq('created_by', filters.created_by);
          }
          if (filters?.status) {
            query = query.eq('status', filters.status);
          }
          if (filters?.priority) {
            query = query.eq('priority', filters.priority);
          }
          if (filters?.search) {
            query = query.ilike('title', `%${filters.search}%`);
          }

          const { data, error } = await query;
          if (error) {
            if (error.code === 'PGRST205' || error.message?.includes('PGRST205')) {
              return this.fallbackList(filters);
            }
            handleDbError('tasks.list', error);
          }
          return (data || []).map(mapSupabaseTask);
        } catch (err: any) {
          if (err.code === 'PGRST205' || err.message?.includes('PGRST205')) {
            return this.fallbackList(filters);
          }
          throw err;
        }
      }
      return this.fallbackList(filters);
    },

    async fallbackList(filters?: {
      assigned_to?: string;
      created_by?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      search?: string;
    }): Promise<TaskRecord[]> {
      const allTasks = await getStoredTasks();
      let filtered = [...allTasks];

      if (filters?.assigned_to) {
        filtered = filtered.filter(t => t.assigned_to === filters.assigned_to);
      }
      if (filters?.created_by) {
        filtered = filtered.filter(t => t.created_by === filters.created_by);
      }
      if (filters?.status) {
        filtered = filtered.filter(t => t.status === filters.status);
      }
      if (filters?.priority) {
        filtered = filtered.filter(t => t.priority === filters.priority);
      }
      if (filters?.search) {
        const s = filters.search.toLowerCase();
        filtered = filtered.filter(t => t.title.toLowerCase().includes(s) || (t.description && t.description.toLowerCase().includes(s)));
      }

      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return Promise.all(filtered.map(enrichTaskRecord));
    },

    async getById(id: string): Promise<TaskRecord | null> {
      assertDatastoreMode();
      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        try {
          const { data, error } = await supabase
            .from('tasks')
            .select(`
              *,
              assigned_user:users!tasks_assigned_to_fkey(id, full_name, email),
              created_user:users!tasks_created_by_fkey(id, full_name, email),
              employee:employees(id, full_name, employee_id),
              document:documents(id, document_number, title)
            `)
            .eq('id', id)
            .maybeSingle();

          if (error) {
            if (error.code === 'PGRST205' || error.message?.includes('PGRST205')) {
              return this.fallbackGetById(id);
            }
            handleDbError('tasks.getById', error);
          }
          return data ? mapSupabaseTask(data) : null;
        } catch (err: any) {
          if (err.code === 'PGRST205' || err.message?.includes('PGRST205')) {
            return this.fallbackGetById(id);
          }
          throw err;
        }
      }
      return this.fallbackGetById(id);
    },

    async fallbackGetById(id: string): Promise<TaskRecord | null> {
      const allTasks = await getStoredTasks();
      const task = allTasks.find(t => t.id === id);
      if (!task) return null;
      return enrichTaskRecord(task);
    },

    async create(data: {
      title: string;
      description?: string | null;
      assigned_to: string;
      created_by: string;
      priority?: TaskPriority;
      status?: TaskStatus;
      due_date?: string | null;
      employee_id?: string | null;
      document_id?: string | null;
    }): Promise<TaskRecord> {
      assertDatastoreMode();
      const validPriorities: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
      const validStatuses: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED'];

      const priority = data.priority || 'MEDIUM';
      if (!validPriorities.includes(priority)) {
        throw new Error(`Invalid priority '${priority}'. Allowed: ${validPriorities.join(', ')}`);
      }

      const status = data.status || 'TODO';
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status '${status}'. Allowed: ${validStatuses.join(', ')}`);
      }

      if (!data.title || !data.title.trim()) {
        throw new Error('Task title is required.');
      }
      if (!data.assigned_to) {
        throw new Error('Assigned user is required.');
      }
      if (!data.created_by) {
        throw new Error('Task creator is required.');
      }

      const now = new Date().toISOString();
      const record: TaskRecord = {
        id: crypto.randomUUID(),
        title: data.title.trim(),
        description: data.description ? data.description.trim() : null,
        assigned_to: data.assigned_to,
        created_by: data.created_by,
        priority,
        status,
        due_date: data.due_date || null,
        employee_id: data.employee_id || null,
        document_id: data.document_id || null,
        created_at: now,
        updated_at: now,
      };

      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        try {
          const { error } = await supabase.from('tasks').insert({
            id: record.id,
            title: record.title,
            description: record.description,
            assigned_to: record.assigned_to,
            created_by: record.created_by,
            priority: record.priority,
            status: record.status,
            due_date: record.due_date,
            employee_id: record.employee_id,
            document_id: record.document_id,
            created_at: record.created_at,
            updated_at: record.updated_at,
          });

          if (error) {
            if (error.code === 'PGRST205' || error.message?.includes('PGRST205')) {
              return this.fallbackCreate(record);
            }
            handleDbError('tasks.create', error);
          }
          return (await this.getById(record.id)) || record;
        } catch (err: any) {
          if (err.code === 'PGRST205' || err.message?.includes('PGRST205')) {
            return this.fallbackCreate(record);
          }
          throw err;
        }
      }

      return this.fallbackCreate(record);
    },

    async fallbackCreate(record: TaskRecord): Promise<TaskRecord> {
      const allTasks = await getStoredTasks();
      allTasks.unshift(record);
      await saveStoredTasks(allTasks);
      return enrichTaskRecord(record);
    },

    async update(id: string, updates: Partial<{
      title: string;
      description: string | null;
      assigned_to: string;
      priority: TaskPriority;
      status: TaskStatus;
      due_date: string | null;
      employee_id: string | null;
      document_id: string | null;
    }>): Promise<TaskRecord> {
      assertDatastoreMode();
      const validPriorities: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
      const validStatuses: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED'];

      if (updates.priority && !validPriorities.includes(updates.priority)) {
        throw new Error(`Invalid priority '${updates.priority}'. Allowed: ${validPriorities.join(', ')}`);
      }
      if (updates.status && !validStatuses.includes(updates.status)) {
        throw new Error(`Invalid status '${updates.status}'. Allowed: ${validStatuses.join(', ')}`);
      }

      const now = new Date().toISOString();
      const payload: Record<string, any> = { ...updates, updated_at: now };

      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        try {
          const { error } = await supabase
            .from('tasks')
            .update(payload)
            .eq('id', id);

          if (error) {
            if (error.code === 'PGRST205' || error.message?.includes('PGRST205')) {
              return this.fallbackUpdate(id, payload);
            }
            handleDbError('tasks.update', error);
          }
          const updated = await this.getById(id);
          if (!updated) throw new Error('Task not found after update.');
          return updated;
        } catch (err: any) {
          if (err.code === 'PGRST205' || err.message?.includes('PGRST205')) {
            return this.fallbackUpdate(id, payload);
          }
          throw err;
        }
      }

      return this.fallbackUpdate(id, payload);
    },

    async fallbackUpdate(id: string, payload: Record<string, any>): Promise<TaskRecord> {
      const allTasks = await getStoredTasks();
      const idx = allTasks.findIndex(t => t.id === id);
      if (idx === -1) throw new Error(`Task '${id}' not found.`);

      allTasks[idx] = {
        ...allTasks[idx],
        ...payload,
      };
      await saveStoredTasks(allTasks);
      return enrichTaskRecord(allTasks[idx]);
    },

    async delete(id: string): Promise<boolean> {
      assertDatastoreMode();
      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        try {
          const { error } = await supabase.from('tasks').delete().eq('id', id);
          if (error) {
            if (error.code === 'PGRST205' || error.message?.includes('PGRST205')) {
              return this.fallbackDelete(id);
            }
            handleDbError('tasks.delete', error);
          }
          return true;
        } catch (err: any) {
          if (err.code === 'PGRST205' || err.message?.includes('PGRST205')) {
            return this.fallbackDelete(id);
          }
          throw err;
        }
      }
      return this.fallbackDelete(id);
    },

    async fallbackDelete(id: string): Promise<boolean> {
      const allTasks = await getStoredTasks();
      const filtered = allTasks.filter(t => t.id !== id);
      await saveStoredTasks(filtered);
      return true;
    },

    async getSummary(userId?: string): Promise<{
      myOpen: number;
      assignedToMe: number;
      createdByMe: number;
      completed: number;
      total: number;
    }> {
      const all = await this.list();
      return {
        myOpen: all.filter(t => (!userId || t.assigned_to === userId) && ['TODO', 'IN_PROGRESS', 'BLOCKED'].includes(t.status)).length,
        assignedToMe: all.filter(t => !userId || t.assigned_to === userId).length,
        createdByMe: all.filter(t => !userId || t.created_by === userId).length,
        completed: all.filter(t => t.status === 'COMPLETED').length,
        total: all.length,
      };
    }
  },

  corporateMetadata: {
    async get(): Promise<CorporateMetadata> {
      assertDatastoreMode();
      const defaultMetadata: CorporateMetadata = {
        brand_name: 'Varsaka Labs',
        legal_entity: 'Varsaka Labs',
        corporate_website: 'https://varsaka.com',
        corporate_email: 'info@varsaka.com',
        registered_office_address: 'APHB Colony, JV Colony, Indira Nagar, Gachibowli, Hyderabad, Telangana 500032',
        cin: '',
      };

      try {
        const stored = await db.systemSettings.get<CorporateMetadata>('corporate_metadata');
        if (stored) {
          return { ...defaultMetadata, ...stored };
        }
      } catch (err) {
        console.warn('Could not read corporate_metadata from systemSettings:', err);
      }
      return defaultMetadata;
    },

    async update(data: Partial<CorporateMetadata>, updatedBy: string): Promise<CorporateMetadata> {
      assertDatastoreMode();
      const current = await this.get();
      const updated: CorporateMetadata = {
        ...current,
        ...data,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy,
      };

      await db.systemSettings.set('corporate_metadata', updated, 'Corporate legal entity and metadata');

      await logAuditEvent({
        action: 'CORPORATE_METADATA_UPDATED',
        userId: updatedBy,
        resourceType: 'SYSTEM_SETTINGS',
        resourceId: 'corporate_metadata',
        metadata: {
          previous: current,
          updated: updated,
        },
      });

      return updated;
    }
  },

  certificateRequests: {
    async list(): Promise<CertificateAccessRequest[]> {
      assertDatastoreMode();
      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        try {
          const { data, error } = await supabase
            .from('certificate_access_requests')
            .select('*')
            .order('created_at', { ascending: false });

          if (!error && data) {
            return data as CertificateAccessRequest[];
          }
          if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
            return (await db.systemSettings.get<CertificateAccessRequest[]>('certificate_access_requests')) || [];
          }
        } catch {
          return (await db.systemSettings.get<CertificateAccessRequest[]>('certificate_access_requests')) || [];
        }
      }
      return (await db.systemSettings.get<CertificateAccessRequest[]>('certificate_access_requests')) || [];
    },

    async create(request: {
      user_id: string;
      user_name: string;
      user_email: string;
      department?: string;
      requested_permission?: string;
    }): Promise<CertificateAccessRequest> {
      assertDatastoreMode();
      const newReq: CertificateAccessRequest = {
        id: `cert-req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        user_id: request.user_id,
        user_name: request.user_name,
        user_email: request.user_email,
        department: request.department || 'General',
        requested_permission: request.requested_permission || 'Certificate Generation',
        status: 'PENDING',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        try {
          const { error } = await supabase
            .from('certificate_access_requests')
            .insert(newReq);

          if (!error) {
            await logAuditEvent({
              action: 'CERTIFICATE_ACCESS_REQUESTED',
              userId: request.user_id,
              userEmail: request.user_email,
              resourceType: 'USER',
              resourceId: request.user_id,
              metadata: { request_id: newReq.id, permission: newReq.requested_permission },
            });
            return newReq;
          }
        } catch {
          // Fallback to systemSettings if table not yet migrated
        }
      }

      const list = (await db.systemSettings.get<CertificateAccessRequest[]>('certificate_access_requests')) || [];
      list.unshift(newReq);
      await db.systemSettings.set('certificate_access_requests', list, 'Certificate access requests queue');

      await logAuditEvent({
        action: 'CERTIFICATE_ACCESS_REQUESTED',
        userId: request.user_id,
        userEmail: request.user_email,
        resourceType: 'USER',
        resourceId: request.user_id,
        metadata: { request_id: newReq.id, permission: newReq.requested_permission },
      });

      return newReq;
    },

    async approve(id: string, reviewedBy: string): Promise<CertificateAccessRequest> {
      assertDatastoreMode();
      const list = await this.list();
      const req = list.find(r => r.id === id);
      if (!req) throw new Error('Certificate access request not found');

      req.status = 'APPROVED';
      req.reviewed_by = reviewedBy;
      req.reviewed_at = new Date().toISOString();
      req.updated_at = new Date().toISOString();

      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        try {
          await supabase
            .from('certificate_access_requests')
            .update({
              status: req.status,
              reviewed_by: req.reviewed_by,
              reviewed_at: req.reviewed_at,
              updated_at: req.updated_at,
            })
            .eq('id', id);
        } catch {
          // Fallback to systemSettings update if table not yet migrated
        }
      }

      const stored = (await db.systemSettings.get<CertificateAccessRequest[]>('certificate_access_requests')) || [];
      const updatedList = stored.map((r: CertificateAccessRequest) => r.id === id ? req : r);
      await db.systemSettings.set('certificate_access_requests', updatedList, 'Certificate access requests queue');

      try {
        await db.users.setPermissionOverride(req.user_id, 'document.certificate.create', true, reviewedBy);
      } catch (err) {
        console.warn('Could not grant permission override for certificate generation:', err);
      }

      await logAuditEvent({
        action: 'CERTIFICATE_ACCESS_APPROVED',
        userId: reviewedBy,
        resourceType: 'USER',
        resourceId: req.user_id,
        metadata: { request_id: id, granted_permission: 'document.certificate.create' },
      });

      return req;
    },

    async reject(id: string, reviewedBy: string, reason: string): Promise<CertificateAccessRequest> {
      assertDatastoreMode();
      const list = await this.list();
      const req = list.find(r => r.id === id);
      if (!req) throw new Error('Certificate access request not found');

      req.status = 'REJECTED';
      req.rejection_reason = reason;
      req.reviewed_by = reviewedBy;
      req.reviewed_at = new Date().toISOString();
      req.updated_at = new Date().toISOString();

      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        try {
          await supabase
            .from('certificate_access_requests')
            .update({
              status: req.status,
              rejection_reason: req.rejection_reason,
              reviewed_by: req.reviewed_by,
              reviewed_at: req.reviewed_at,
              updated_at: req.updated_at,
            })
            .eq('id', id);
        } catch {
          // Fallback to systemSettings update if table not yet migrated
        }
      }

      const stored = (await db.systemSettings.get<CertificateAccessRequest[]>('certificate_access_requests')) || [];
      const updatedList = stored.map((r: CertificateAccessRequest) => r.id === id ? req : r);
      await db.systemSettings.set('certificate_access_requests', updatedList, 'Certificate access requests queue');

      await logAuditEvent({
        action: 'CERTIFICATE_ACCESS_REJECTED',
        userId: reviewedBy,
        resourceType: 'USER',
        resourceId: req.user_id,
        metadata: { request_id: id, rejection_reason: reason },
      });

      return req;
    }
  },

  userCredentials: {
    async getByUserId(userId: string): Promise<UserCredential | null> {
      assertDatastoreMode();
      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        const { data, error } = await supabase
          .from('user_credentials')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (error) {
          return null;
        }
        return data as UserCredential | null;
      }

      if (isProductionEnv()) {
        return null;
      }

      const state = localDb.getState();
      return (state.user_credentials || []).find((c) => c.user_id === userId) || null;
    },

    async create(params: {
      userId: string;
      passwordHash: string;
      mustChangePassword?: boolean;
      tempPasswordExpiresAt?: string | null;
    }): Promise<UserCredential> {
      assertDatastoreMode();
      const now = new Date().toISOString();
      const credRecord: UserCredential = {
        id: crypto.randomUUID(),
        user_id: params.userId,
        password_hash: params.passwordHash,
        password_updated_at: now,
        failed_attempts: 0,
        locked_until: null,
        session_version: 1,
        must_change_password: params.mustChangePassword ?? false,
        temp_password_expires_at: params.tempPasswordExpiresAt || null,
        created_at: now,
        updated_at: now,
      };

      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        const { data, error } = await supabase
          .from('user_credentials')
          .upsert({
            user_id: credRecord.user_id,
            password_hash: credRecord.password_hash,
            password_updated_at: credRecord.password_updated_at,
            failed_attempts: 0,
            locked_until: null,
            session_version: 1,
            must_change_password: credRecord.must_change_password,
            temp_password_expires_at: credRecord.temp_password_expires_at,
            updated_at: now,
          }, { onConflict: 'user_id' })
          .select('*')
          .single();

        if (error) handleDbError('user_credentials.create', error);
        return data as UserCredential;
      }

      const state = localDb.getState();
      if (!state.user_credentials) state.user_credentials = [];
      const idx = state.user_credentials.findIndex((c) => c.user_id === params.userId);
      if (idx >= 0) {
        state.user_credentials[idx] = credRecord;
      } else {
        state.user_credentials.push(credRecord);
      }
      localDb.save();
      return credRecord;
    },

    async updatePassword(userId: string, newHash: string): Promise<void> {
      assertDatastoreMode();
      const now = new Date().toISOString();
      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        const { data: current } = await supabase
          .from('user_credentials')
          .select('session_version')
          .eq('user_id', userId)
          .maybeSingle();

        const nextVersion = (current?.session_version || 1) + 1;

        const { error } = await supabase
          .from('user_credentials')
          .update({
            password_hash: newHash,
            password_updated_at: now,
            must_change_password: false,
            temp_password_expires_at: null,
            failed_attempts: 0,
            locked_until: null,
            session_version: nextVersion,
            updated_at: now,
          })
          .eq('user_id', userId);

        if (error) throw new Error(`Failed to update user credential: ${error.message}`);
        return;
      }

      const state = localDb.getState();
      if (!state.user_credentials) state.user_credentials = [];
      const cred = state.user_credentials.find((c) => c.user_id === userId);
      if (cred) {
        cred.password_hash = newHash;
        cred.password_updated_at = now;
        cred.must_change_password = false;
        cred.temp_password_expires_at = null;
        cred.failed_attempts = 0;
        cred.locked_until = null;
        cred.session_version = (cred.session_version || 1) + 1;
        cred.updated_at = now;
        localDb.save();
      }
    },

    async resetPassword(userId: string, tempHash: string, expiresAt: string): Promise<void> {
      assertDatastoreMode();
      const now = new Date().toISOString();
      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        const { data: current } = await supabase
          .from('user_credentials')
          .select('session_version')
          .eq('user_id', userId)
          .maybeSingle();

        const nextVersion = (current?.session_version || 1) + 1;

        const { error } = await supabase
          .from('user_credentials')
          .upsert({
            user_id: userId,
            password_hash: tempHash,
            password_updated_at: now,
            must_change_password: true,
            temp_password_expires_at: expiresAt,
            failed_attempts: 0,
            locked_until: null,
            session_version: nextVersion,
            updated_at: now,
          }, { onConflict: 'user_id' });

        if (error) throw new Error(`Failed to reset user credential: ${error.message}`);
        return;
      }

      const state = localDb.getState();
      if (!state.user_credentials) state.user_credentials = [];
      let cred = state.user_credentials.find((c) => c.user_id === userId);
      if (cred) {
        cred.password_hash = tempHash;
        cred.password_updated_at = now;
        cred.must_change_password = true;
        cred.temp_password_expires_at = expiresAt;
        cred.failed_attempts = 0;
        cred.locked_until = null;
        cred.session_version = (cred.session_version || 1) + 1;
        cred.updated_at = now;
      } else {
        cred = {
          id: crypto.randomUUID(),
          user_id: userId,
          password_hash: tempHash,
          password_updated_at: now,
          failed_attempts: 0,
          locked_until: null,
          session_version: 2,
          must_change_password: true,
          temp_password_expires_at: expiresAt,
          created_at: now,
          updated_at: now,
        };
        state.user_credentials.push(cred);
      }
      localDb.save();
    },

    async recordFailedAttempt(userId: string, maxAttempts: number = 5, lockoutMinutes: number = 15): Promise<{ isLocked: boolean; remainingAttempts: number; lockoutSeconds?: number }> {
      assertDatastoreMode();
      const now = new Date();
      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        const { data: cred } = await supabase
          .from('user_credentials')
          .select('failed_attempts, locked_until')
          .eq('user_id', userId)
          .maybeSingle();

        const currentAttempts = (cred?.failed_attempts || 0) + 1;
        const isLocked = currentAttempts >= maxAttempts;
        const lockedUntil = isLocked ? new Date(now.getTime() + lockoutMinutes * 60 * 1000).toISOString() : null;

        await supabase
          .from('user_credentials')
          .update({
            failed_attempts: currentAttempts,
            locked_until: lockedUntil,
            updated_at: now.toISOString(),
          })
          .eq('user_id', userId);

        return {
          isLocked,
          remainingAttempts: Math.max(0, maxAttempts - currentAttempts),
          lockoutSeconds: isLocked ? lockoutMinutes * 60 : undefined,
        };
      }

      const state = localDb.getState();
      if (!state.user_credentials) state.user_credentials = [];
      const cred = state.user_credentials.find((c) => c.user_id === userId);
      if (cred) {
        cred.failed_attempts = (cred.failed_attempts || 0) + 1;
        const isLocked = cred.failed_attempts >= maxAttempts;
        if (isLocked) {
          cred.locked_until = new Date(now.getTime() + lockoutMinutes * 60 * 1000).toISOString();
        }
        cred.updated_at = now.toISOString();
        localDb.save();
        return {
          isLocked,
          remainingAttempts: Math.max(0, maxAttempts - cred.failed_attempts),
          lockoutSeconds: isLocked ? lockoutMinutes * 60 : undefined,
        };
      }
      return { isLocked: false, remainingAttempts: maxAttempts - 1 };
    },

    async resetFailedAttempts(userId: string): Promise<void> {
      assertDatastoreMode();
      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        await supabase
          .from('user_credentials')
          .update({
            failed_attempts: 0,
            locked_until: null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
        return;
      }

      const state = localDb.getState();
      if (!state.user_credentials) return;
      const cred = state.user_credentials.find((c) => c.user_id === userId);
      if (cred) {
        cred.failed_attempts = 0;
        cred.locked_until = null;
        cred.updated_at = new Date().toISOString();
        localDb.save();
      }
    },

    async incrementSessionVersion(userId: string): Promise<number> {
      assertDatastoreMode();
      const now = new Date().toISOString();
      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        const { data: cred } = await supabase
          .from('user_credentials')
          .select('session_version')
          .eq('user_id', userId)
          .maybeSingle();

        const nextVersion = (cred?.session_version || 1) + 1;
        await supabase
          .from('user_credentials')
          .update({
            session_version: nextVersion,
            updated_at: now,
          })
          .eq('user_id', userId);
        return nextVersion;
      }

      const state = localDb.getState();
      if (!state.user_credentials) state.user_credentials = [];
      const cred = state.user_credentials.find((c) => c.user_id === userId);
      if (cred) {
        cred.session_version = (cred.session_version || 1) + 1;
        cred.updated_at = now;
        localDb.save();
        return cred.session_version;
      }
      return 1;
    },

    async getSessionVersion(userId: string): Promise<number | null> {
      assertDatastoreMode();
      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        const { data: cred } = await supabase
          .from('user_credentials')
          .select('session_version')
          .eq('user_id', userId)
          .maybeSingle();
        return cred?.session_version ?? null;
      }

      const state = localDb.getState();
      const cred = (state.user_credentials || []).find((c) => c.user_id === userId);
      return cred?.session_version ?? null;
    },
  },

  userMfa: {
    async getByUserId(userId: string): Promise<UserMfa | null> {
      assertDatastoreMode();
      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        const { data, error } = await supabase
          .from('user_mfa')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (error) {
          // Fail-closed: database query errors (e.g. missing table, schema error, connection drop)
          // must NEVER be interpreted as MFA disabled.
          throw new Error(`Database error (user_mfa.getByUserId): ${error.message}`);
        }
        return data as UserMfa | null;
      }

      if (isProductionEnv()) {
        throw new Error('FATAL: Attempted to read local mock user_mfa in production environment.');
      }

      const state = localDb.getState();
      return (state.user_mfa || []).find((m) => m.user_id === userId) || null;
    },

    async setChallengeNonce(userId: string, nonce: string | null): Promise<void> {
      assertDatastoreMode();
      const now = new Date().toISOString();
      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        const { error } = await supabase
          .from('user_mfa')
          .update({
            current_challenge_nonce: nonce,
            updated_at: now,
          })
          .eq('user_id', userId);

        if (error) {
          console.warn('user_mfa.setChallengeNonce warning:', error.message);
        }
        return;
      }

      if (isProductionEnv()) {
        throw new Error('FATAL: Attempted to write local mock user_mfa in production environment.');
      }

      const state = localDb.getState();
      if (!state.user_mfa) return;
      const mfa = state.user_mfa.find((m) => m.user_id === userId);
      if (mfa) {
        mfa.current_challenge_nonce = nonce;
        mfa.updated_at = now;
        localDb.save();
      }
    },

    /**
     * Atomically consumes an active MFA challenge nonce.
     * Equivalent to:
     * UPDATE public.user_mfa
     * SET current_challenge_nonce = NULL, updated_at = NOW()
     * WHERE user_id = $userId AND current_challenge_nonce = $nonce
     * RETURNING user_id;
     * Returns true if exactly 1 row was updated, false if 0 rows matched (already consumed or mismatched).
     */
    async consumeChallengeNonce(userId: string, nonce: string): Promise<boolean> {
      assertDatastoreMode();
      if (!userId || !nonce) return false;
      const now = new Date().toISOString();

      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        const { data, error } = await supabase
          .from('user_mfa')
          .update({
            current_challenge_nonce: null,
            updated_at: now,
          })
          .eq('user_id', userId)
          .eq('current_challenge_nonce', nonce)
          .select('user_id');

        if (error) {
          throw new Error(`Database error (user_mfa.consumeChallengeNonce): ${error.message}`);
        }

        return Array.isArray(data) && data.length > 0;
      }

      if (isProductionEnv()) {
        throw new Error('FATAL: Attempted to write local mock user_mfa in production environment.');
      }

      const state = localDb.getState();
      if (!state.user_mfa) return false;
      const mfa = state.user_mfa.find((m) => m.user_id === userId && m.current_challenge_nonce === nonce);
      if (!mfa) return false;
      mfa.current_challenge_nonce = null;
      mfa.updated_at = now;
      localDb.save();
      return true;
    },

    async createOrUpdatePending(params: {
      userId: string;
      encryptedSecret: string;
      recoveryCodesHashes: string[];
    }): Promise<UserMfa> {
      assertDatastoreMode();
      const now = new Date().toISOString();
      const mfaRecord: UserMfa = {
        id: crypto.randomUUID(),
        user_id: params.userId,
        method: 'totp',
        secret_encrypted: params.encryptedSecret,
        is_enabled: false,
        is_verified: false,
        recovery_codes_hashes: params.recoveryCodesHashes,
        failed_attempts: 0,
        locked_until: null,
        last_used_at: null,
        current_challenge_nonce: null,
        created_at: now,
        updated_at: now,
      };

      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        const { data, error } = await supabase
          .from('user_mfa')
          .upsert({
            user_id: params.userId,
            method: 'totp',
            secret_encrypted: params.encryptedSecret,
            is_enabled: false,
            is_verified: false,
            recovery_codes_hashes: params.recoveryCodesHashes,
            failed_attempts: 0,
            locked_until: null,
            current_challenge_nonce: null,
            updated_at: now,
          }, { onConflict: 'user_id' })
          .select('*')
          .single();

        if (error) handleDbError('user_mfa.createOrUpdatePending', error);
        return data as UserMfa;
      }

      if (isProductionEnv()) {
        throw new Error('FATAL: Attempted to write local mock user_mfa in production environment.');
      }

      const state = localDb.getState();
      if (!state.user_mfa) state.user_mfa = [];
      const idx = state.user_mfa.findIndex((m) => m.user_id === params.userId);
      if (idx >= 0) {
        state.user_mfa[idx] = {
          ...state.user_mfa[idx],
          ...mfaRecord,
          id: state.user_mfa[idx].id,
          created_at: state.user_mfa[idx].created_at,
        };
      } else {
        state.user_mfa.push(mfaRecord);
      }
      localDb.save();
      return mfaRecord;
    },

    async enableMfa(userId: string): Promise<void> {
      assertDatastoreMode();
      const now = new Date().toISOString();
      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        const { error } = await supabase
          .from('user_mfa')
          .update({
            is_enabled: true,
            is_verified: true,
            failed_attempts: 0,
            locked_until: null,
            last_used_at: now,
            current_challenge_nonce: null,
            updated_at: now,
          })
          .eq('user_id', userId);

        if (error) throw new Error(`Failed to enable MFA: ${error.message}`);
        return;
      }

      if (isProductionEnv()) {
        throw new Error('FATAL: Attempted to write local mock user_mfa in production environment.');
      }

      const state = localDb.getState();
      if (!state.user_mfa) return;
      const mfa = state.user_mfa.find((m) => m.user_id === userId);
      if (mfa) {
        mfa.is_enabled = true;
        mfa.is_verified = true;
        mfa.failed_attempts = 0;
        mfa.locked_until = null;
        mfa.last_used_at = now;
        mfa.current_challenge_nonce = null;
        mfa.updated_at = now;
        localDb.save();
      }
    },

    async recordFailedAttempt(userId: string, maxAttempts: number = 5, lockoutMinutes: number = 15): Promise<{ isLocked: boolean; remainingAttempts: number; lockoutSeconds?: number }> {
      assertDatastoreMode();
      const now = new Date();
      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        const { data: mfa, error: fetchErr } = await supabase
          .from('user_mfa')
          .select('failed_attempts, locked_until')
          .eq('user_id', userId)
          .maybeSingle();

        if (fetchErr) throw new Error(`Database error (user_mfa.recordFailedAttempt): ${fetchErr.message}`);

        const currentAttempts = (mfa?.failed_attempts || 0) + 1;
        const isLocked = currentAttempts >= maxAttempts;
        const lockedUntil = isLocked ? new Date(now.getTime() + lockoutMinutes * 60 * 1000).toISOString() : null;

        const { error: updateErr } = await supabase
          .from('user_mfa')
          .update({
            failed_attempts: currentAttempts,
            locked_until: lockedUntil,
            updated_at: now.toISOString(),
          })
          .eq('user_id', userId);

        if (updateErr) throw new Error(`Database error (user_mfa.recordFailedAttempt update): ${updateErr.message}`);

        return {
          isLocked,
          remainingAttempts: Math.max(0, maxAttempts - currentAttempts),
          lockoutSeconds: isLocked ? lockoutMinutes * 60 : undefined,
        };
      }

      if (isProductionEnv()) {
        throw new Error('FATAL: Attempted to write local mock user_mfa in production environment.');
      }

      const state = localDb.getState();
      if (!state.user_mfa) state.user_mfa = [];
      const mfa = state.user_mfa.find((m) => m.user_id === userId);
      if (mfa) {
        mfa.failed_attempts = (mfa.failed_attempts || 0) + 1;
        const isLocked = mfa.failed_attempts >= maxAttempts;
        if (isLocked) {
          mfa.locked_until = new Date(now.getTime() + lockoutMinutes * 60 * 1000).toISOString();
        }
        mfa.updated_at = now.toISOString();
        localDb.save();
        return {
          isLocked,
          remainingAttempts: Math.max(0, maxAttempts - mfa.failed_attempts),
          lockoutSeconds: isLocked ? lockoutMinutes * 60 : undefined,
        };
      }
      return { isLocked: false, remainingAttempts: maxAttempts - 1 };
    },

    async resetFailedAttempts(userId: string): Promise<void> {
      assertDatastoreMode();
      const now = new Date().toISOString();
      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        const { error } = await supabase
          .from('user_mfa')
          .update({
            failed_attempts: 0,
            locked_until: null,
            last_used_at: now,
            updated_at: now,
          })
          .eq('user_id', userId);
        if (error) throw new Error(`Database error (user_mfa.resetFailedAttempts): ${error.message}`);
        return;
      }

      if (isProductionEnv()) {
        throw new Error('FATAL: Attempted to write local mock user_mfa in production environment.');
      }

      const state = localDb.getState();
      if (!state.user_mfa) return;
      const mfa = state.user_mfa.find((m) => m.user_id === userId);
      if (mfa) {
        mfa.failed_attempts = 0;
        mfa.locked_until = null;
        mfa.last_used_at = now;
        mfa.updated_at = now;
        localDb.save();
      }
    },

    async consumeRecoveryCode(userId: string, codeHash: string): Promise<boolean> {
      assertDatastoreMode();
      const now = new Date().toISOString();
      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        const { data: mfa, error: fetchErr } = await supabase
          .from('user_mfa')
          .select('recovery_codes_hashes')
          .eq('user_id', userId)
          .maybeSingle();

        if (fetchErr) throw new Error(`Database error (user_mfa.consumeRecoveryCode): ${fetchErr.message}`);

        const hashes: string[] = mfa?.recovery_codes_hashes || [];
        const index = hashes.indexOf(codeHash);
        if (index === -1) return false;

        const updatedHashes = hashes.filter((_, idx) => idx !== index);
        const { error: updateErr } = await supabase
          .from('user_mfa')
          .update({
            recovery_codes_hashes: updatedHashes,
            failed_attempts: 0,
            locked_until: null,
            last_used_at: now,
            updated_at: now,
          })
          .eq('user_id', userId);

        if (updateErr) throw new Error(`Database error (user_mfa.consumeRecoveryCode update): ${updateErr.message}`);

        return true;
      }

      if (isProductionEnv()) {
        throw new Error('FATAL: Attempted to write local mock user_mfa in production environment.');
      }

      const state = localDb.getState();
      if (!state.user_mfa) return false;
      const mfa = state.user_mfa.find((m) => m.user_id === userId);
      if (!mfa || !mfa.recovery_codes_hashes) return false;
      const index = mfa.recovery_codes_hashes.indexOf(codeHash);
      if (index === -1) return false;

      mfa.recovery_codes_hashes = mfa.recovery_codes_hashes.filter((_, idx) => idx !== index);
      mfa.failed_attempts = 0;
      mfa.locked_until = null;
      mfa.last_used_at = now;
      mfa.updated_at = now;
      localDb.save();
      return true;
    },

    async resetMfa(userId: string): Promise<void> {
      assertDatastoreMode();
      const now = new Date().toISOString();
      if (isSupabaseMode()) {
        const supabase = getSupabaseAdminClient();
        const { error } = await supabase
          .from('user_mfa')
          .update({
            is_enabled: false,
            is_verified: false,
            secret_encrypted: null,
            recovery_codes_hashes: [],
            failed_attempts: 0,
            locked_until: null,
            last_used_at: null,
            current_challenge_nonce: null,
            updated_at: now,
          })
          .eq('user_id', userId);
        if (error) throw new Error(`Database error (user_mfa.resetMfa): ${error.message}`);
        return;
      }

      if (isProductionEnv()) {
        throw new Error('FATAL: Attempted to write local mock user_mfa in production environment.');
      }

      const state = localDb.getState();
      if (!state.user_mfa) return;
      const mfa = state.user_mfa.find((m) => m.user_id === userId);
      if (mfa) {
        mfa.is_enabled = false;
        mfa.is_verified = false;
        mfa.secret_encrypted = null;
        mfa.recovery_codes_hashes = [];
        mfa.failed_attempts = 0;
        mfa.locked_until = null;
        mfa.last_used_at = null;
        mfa.current_challenge_nonce = null;
        mfa.updated_at = now;
        localDb.save();
      }
    },
  },
};


