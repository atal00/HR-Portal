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
  | 'security.view';

export type EmployeeStatus = 'ACTIVE' | 'INTERN' | 'ON_NOTICE' | 'SEPARATED' | 'INACTIVE';
export type EmploymentType = 'FULL_TIME' | 'INTERNSHIP' | 'CONTRACT';

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

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  is_active: boolean;
  role: RoleCode;
  permissions: PermissionCode[];
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
  employee_id: string; // e.g. "VL 1083"
  full_name: string;
  email: string;
  phone: string;
  address: string;
  department_id: string;
  department_name?: string;
  designation: string;
  joining_date: string;
  last_working_date?: string | null;
  employment_type: EmploymentType;
  work_location: string;
  reporting_manager?: string;
  status: EmployeeStatus;
  created_by?: string;
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
  employee_pf: number;
  employer_pf: number;
  professional_tax: number;
  gratuity: number;
  tds: number;
  variable_pay: number;
  net_salary: number;
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
  status_result: 'VALID' | 'REVOKED' | 'NOT_FOUND';
  ip_address?: string;
  user_agent?: string;
  verified_at: string;
}

export interface PublicVerificationResult {
  status: 'VALID' | 'REVOKED' | 'NOT_FOUND';
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
  verified_at: string;
}
