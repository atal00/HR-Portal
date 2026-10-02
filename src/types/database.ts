// ==============================================================================
// VARSAKA HR DOCUMENT MANAGEMENT & VERIFICATION PORTAL
// Database & Domain Type Definitions
// ==============================================================================

export type RoleCode = 
  | 'SUPER_ADMIN' 
  | 'HR_ADMIN' 
  | 'DOCUMENT_ADMIN' 
  | 'PAYROLL_ADMIN' 
  | 'VIEWER';

export type PermissionCode =
  | 'employee.view'
  | 'employee.create'
  | 'employee.update'
  | 'document.offer.create'
  | 'document.offer.view'
  | 'document.offer.download'
  | 'document.offer.approve'
  | 'document.experience.create'
  | 'document.experience.view'
  | 'document.experience.download'
  | 'document.experience.approve'
  | 'document.relieving.create'
  | 'document.relieving.view'
  | 'document.relieving.download'
  | 'document.relieving.approve'
  | 'document.salary.create'
  | 'document.salary.view'
  | 'document.salary.download'
  | 'document.salary.approve'
  | 'document.certificate.create'
  | 'document.certificate.view'
  | 'document.certificate.download'
  | 'document.certificate.approve'
  | 'document.approve'
  | 'document.reject'
  | 'document.revoke'
  | 'template.create'
  | 'template.update'
  | 'template.publish'
  | 'salary.view'
  | 'salary.update'
  | 'user.create'
  | 'user.update'
  | 'role.assign'
  | 'permission.assign'
  | 'audit.view'
  | 'security.view'
  | 'user.delete'
  | 'employee.delete'
  | 'settings.update'
  | 'certificate.request'
  | 'certificate.approve'
  | 'task.view'
  | 'task.create'
  | 'task.update'
  | 'task.assign'
  | 'task.delete';

export type EmployeeStatus = 'ACTIVE' | 'INTERN' | 'ON_NOTICE' | 'SEPARATED' | 'INACTIVE';
export type EmploymentType = 'FULL_TIME' | 'INTERNSHIP' | 'CONTRACT';
export type DeletionStatus = 'NONE' | 'DELETION_REQUESTED' | 'DELETION_APPROVED' | 'DELETED';

export type DocumentType = 
  | 'OFFER_LETTER' 
  | 'EXPERIENCE_LETTER' 
  | 'RELIEVING_LETTER' 
  | 'SALARY_SLIP' 
  | 'CERTIFICATE';

export type DocumentWorkflowStatus = 
  | 'DRAFT' 
  | 'PREVIEW' 
  | 'VALIDATE' 
  | 'GENERATE' 
  | 'PENDING_APPROVAL' 
  | 'APPROVED' 
  | 'FINAL' 
  | 'REJECTED' 
  | 'REVOKED';

export type TemplateStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface UserPermissionOverride {
  id: string;
  user_id: string;
  permission_code: PermissionCode;
  is_granted: boolean; // true = explicitly granted, false = explicitly revoked
  granted_by?: string;
  created_at: string;
}

export interface User {
  id: string;
  auth_user_id?: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  is_active: boolean;
  role: RoleCode;
  permissions: PermissionCode[];
  department_id?: string;
  department?: string;
  deactivation_reason?: string;
  deletion_status?: DeletionStatus;
  deletion_reason?: string;
  must_change_password?: boolean;
  temp_password_expires_at?: string | null;
  password_hash?: string;
  session_version?: number;
  permission_overrides?: UserPermissionOverride[];
  created_at: string;
  updated_at: string;
}

export interface UserCredential {
  id: string;
  user_id: string;
  password_hash: string;
  password_updated_at: string;
  failed_attempts: number;
  locked_until?: string | null;
  session_version: number;
  must_change_password: boolean;
  temp_password_expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserMfa {
  id: string;
  user_id: string;
  method: 'totp';
  secret_encrypted?: string | null;
  is_enabled: boolean;
  is_verified: boolean;
  recovery_codes_hashes: string[];
  failed_attempts: number;
  locked_until?: string | null;
  last_used_at?: string | null;
  current_challenge_nonce?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  created_at: string;
}

export interface Employee {
  id: string;
  employee_id: string; // e.g. "VL 1083", "EMP-VL-1001"
  full_name: string;
  email: string;
  phone: string;
  address: string;
  department_id: string;
  department_name?: string;
  department?: string;
  custom_department?: string;
  designation: string;
  joining_date: string;
  last_working_date?: string | null;
  employment_type: EmploymentType;
  work_location: string;
  reporting_manager?: string;
  status: EmployeeStatus;
  deletion_status?: DeletionStatus;
  deletion_reason?: string;
  deletion_requested_by?: string;
  deletion_requested_at?: string;
  deletion_approved_by?: string;
  deletion_approved_at?: string;
  is_system_protected?: boolean;

  // Section A - Personal Information
  father_name?: string;
  mother_name?: string;
  date_of_birth?: string;
  gender?: string;
  personal_email?: string;
  alternate_phone?: string;
  permanent_address?: string;
  current_address?: string;
  city?: string;
  state?: string;
  country?: string;
  pin_code?: string;

  // Section B - Identity / Statutory Information
  pan_number?: string;
  aadhaar_number?: string;
  passport_number?: string;
  uan?: string;
  pf_number?: string;
  esic_number?: string;

  // Section C - Employment Information
  probation_period?: string;
  confirmation_date?: string;
  notice_period?: string;
  date_of_separation?: string | null;
  separation_reason?: string;

  // Section D - Bank & Payroll Information
  bank_name?: string;
  bank_account_holder_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  salary_structure?: string;

  // Section E - Document / KYC References
  kyc_documents?: Record<string, string>;

  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CorporateMetadata {
  brand_name: string;
  legal_entity: string;
  corporate_website: string;
  corporate_email: string;
  registered_office_address: string;
  cin: string;
  updated_at?: string;
  updated_by?: string;
}

export interface CertificateAccessRequest {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  department?: string;
  requested_permission: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  rejection_reason?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeSalary {
  id: string;
  employee_id: string;
  annual_ctc: number;
  monthly_gross: number;
  basic: number;
  hra: number;
  communication_allowance: number;
  travel_allowance: number;
  food_allowance: number;
  other_allowances: number;
  special_allowance?: number;
  conveyance?: number;
  employee_pf: number;
  employer_pf: number;
  professional_tax: number;
  gratuity: number;
  tds: number;
  esic?: number;
  other_deductions?: number;
  variable_pay: number;
  net_salary: number;
  pan_number?: string;
  bank_name?: string;
  bank_account_number?: string;
  pf_number?: string;
  effective_date: string;
  updated_at: string;
}

export interface DocumentRecord {
  id: string;
  document_number: string; // e.g. VAR-OFF-2026-000001
  verification_id: string; // e.g. VVR-OFF-4F8A1E
  document_type: DocumentType;
  employee_id: string;
  employee_name?: string;
  employee_code?: string;
  template_id?: string;
  template_version: string;
  title: string;
  status: DocumentWorkflowStatus;
  issue_date: string;
  data_snapshot: Record<string, any>;
  file_path?: string;
  file_size_bytes?: number;
  checksum_sha256?: string;
  created_by: string;
  created_by_name?: string;
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  revoked_by?: string;
  revoked_by_name?: string;
  revoked_at?: string;
  revocation_reason?: string;
  version_number: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  document_number: string;
  verification_id: string;
  status: DocumentWorkflowStatus;
  data_snapshot: Record<string, any>;
  change_reason: string;
  created_by: string;
  created_at: string;
}

export interface TemplateRecord {
  id: string;
  template_code: string;
  name: string;
  document_type: DocumentType;
  current_version: string;
  status: TemplateStatus;
  created_by: string;
  published_by?: string;
  published_at?: string;
  sections?: any[];
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  user_email: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  metadata: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface SecurityLog {
  id: string;
  event_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface VerificationLog {
  id: string;
  verification_id: string;
  document_id?: string;
  status_result: PublicVerificationStatus;
  ip_address?: string;
  user_agent?: string;
  verified_at: string;
}

export type PublicVerificationStatus = 
  | 'VALID' 
  | 'PENDING_APPROVAL' 
  | 'REJECTED' 
  | 'REVOKED' 
  | 'NOT_FOUND';

export interface PublicVerificationResult {
  status: PublicVerificationStatus;
  document_workflow_status?: DocumentWorkflowStatus;
  verification_id: string;
  document_number?: string;
  document_type?: DocumentType;
  document_title?: string;
  candidate_name?: string;
  employee_id?: string;
  issue_date?: string;
  authorized_signatory?: string;
  revocation_reason?: string;
  revoked_at?: string;
  rejection_reason?: string;
  verified_at: string;
}

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';

export interface TaskRecord {
  id: string;
  title: string;
  description?: string | null;
  assigned_to: string; // user UUID
  assigned_to_name?: string;
  assigned_to_email?: string;
  created_by: string; // user UUID
  created_by_name?: string;
  created_by_email?: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date?: string | null;
  employee_id?: string | null;
  employee_name?: string | null;
  employee_code?: string | null;
  document_id?: string | null;
  document_number?: string | null;
  document_title?: string | null;
  created_at: string;
  updated_at: string;
}

