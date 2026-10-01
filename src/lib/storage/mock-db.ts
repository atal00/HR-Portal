import fs from 'fs';
import path from 'path';
import { 
  User, 
  Employee, 
  EmployeeSalary, 
  DocumentRecord, 
  TemplateRecord, 
  AuditLog, 
  SecurityLog, 
  VerificationLog, 
  Department, 
  DocumentType,
  DocumentWorkflowStatus
} from '@/types/database';
import { ROLE_PERMISSIONS } from '@/lib/rbac';
import { formatDocumentNumber, generateVerificationId } from '@/lib/id-generator';

const DATA_DIR = path.join(process.cwd(), '.system_data');
const DATA_FILE = path.join(DATA_DIR, 'db_store.json');

export interface DatabaseState {
  users: User[];
  departments: Department[];
  employees: Employee[];
  employee_salary: EmployeeSalary[];
  templates: TemplateRecord[];
  documents: DocumentRecord[];
  audit_logs: AuditLog[];
  security_logs: SecurityLog[];
  verification_logs: VerificationLog[];
  sequences: Record<DocumentType, number>;
}

// Initial Seed Data with approved Varsaka Labs records
const INITIAL_STATE: DatabaseState = {
  users: [
    {
      id: 'usr-super-admin-01',
      email: 'admin@varsaka.com',
      full_name: 'Dr. Vikram Sarabhai',
      role: 'SUPER_ADMIN',
      permissions: ROLE_PERMISSIONS['SUPER_ADMIN'],
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'usr-hr-admin-01',
      email: 'hr@varsaka.com',
      full_name: 'Sneha Kulkarni',
      role: 'HR_ADMIN',
      permissions: ROLE_PERMISSIONS['HR_ADMIN'],
      is_active: true,
      created_at: '2026-01-10T00:00:00Z',
      updated_at: '2026-01-10T00:00:00Z',
    },
    {
      id: 'usr-doc-admin-01',
      email: 'docs@varsaka.com',
      full_name: 'Rohan Deshmukh',
      role: 'DOCUMENT_ADMIN',
      permissions: ROLE_PERMISSIONS['DOCUMENT_ADMIN'],
      is_active: true,
      created_at: '2026-01-15T00:00:00Z',
      updated_at: '2026-01-15T00:00:00Z',
    },
    {
      id: 'usr-payroll-admin-01',
      email: 'payroll@varsaka.com',
      full_name: 'Ananya Sharma',
      role: 'PAYROLL_ADMIN',
      permissions: ROLE_PERMISSIONS['PAYROLL_ADMIN'],
      is_active: true,
      created_at: '2026-01-20T00:00:00Z',
      updated_at: '2026-01-20T00:00:00Z',
    },
    {
      id: 'usr-viewer-01',
      email: 'auditor@varsaka.com',
      full_name: 'Karthik Raman',
      role: 'VIEWER',
      permissions: ROLE_PERMISSIONS['VIEWER'],
      is_active: true,
      created_at: '2026-02-01T00:00:00Z',
      updated_at: '2026-02-01T00:00:00Z',
    },
  ],

  departments: [
    { id: 'dept-fin-ops', name: 'Finance & Operations', code: 'FIN_OPS', description: 'Financial planning, accounting, and business operations', created_at: '2026-01-01T00:00:00Z' },
    { id: 'dept-eng', name: 'Engineering & Technology', code: 'ENG', description: 'Software engineering, QA and cloud architecture', created_at: '2026-01-01T00:00:00Z' },
    { id: 'dept-hr', name: 'Human Resources', code: 'HR', description: 'People operations and talent development', created_at: '2026-01-01T00:00:00Z' },
    { id: 'dept-product', name: 'Product & Design', code: 'PROD_DES', description: 'Product roadmap and UI/UX design', created_at: '2026-01-01T00:00:00Z' },
  ],

  employees: [
    {
      id: 'emp-test-001',
      employee_id: 'VL 1083',
      full_name: 'Test Employee 001',
      email: 'test.employee001@example.invalid',
      phone: '+91 9000000001',
      address: 'Plot 1, Block A, Financial District, Hyderabad, Telangana 500032',
      department_id: 'dept-fin-ops',
      department_name: 'Finance & Operations',
      designation: 'Finance & Operations Analyst',
      joining_date: '2025-12-01',
      last_working_date: null,
      employment_type: 'FULL_TIME',
      work_location: 'Hyderabad, India',
      reporting_manager: 'Manager Test',
      status: 'ACTIVE',
      created_by: 'usr-hr-admin-01',
      created_at: '2025-11-28T10:00:00Z',
      updated_at: '2025-11-28T10:00:00Z',
    },
    {
      id: 'emp-test-002',
      employee_id: 'VL 1084',
      full_name: 'Test Employee 002',
      email: 'test.employee002@example.invalid',
      phone: '+91 9000000002',
      address: 'Plot 2, Block B, Tech Corridor, Hyderabad, Telangana 500081',
      department_id: 'dept-eng',
      department_name: 'Engineering & Technology',
      designation: 'Senior QA Engineer',
      joining_date: '2025-06-15',
      last_working_date: null,
      employment_type: 'FULL_TIME',
      work_location: 'Hyderabad, India',
      reporting_manager: 'Manager Test',
      status: 'ACTIVE',
      created_by: 'usr-hr-admin-01',
      created_at: '2025-06-10T10:00:00Z',
      updated_at: '2025-06-10T10:00:00Z',
    },
    {
      id: 'emp-test-003',
      employee_id: 'VL 1085',
      full_name: 'Test Employee 003',
      email: 'test.employee003@example.invalid',
      phone: '+91 9000000003',
      address: 'Plot 3, Green Valley, Bengaluru, Karnataka 560103',
      department_id: 'dept-eng',
      department_name: 'Engineering & Technology',
      designation: 'Full-Stack Developer Intern',
      joining_date: '2026-01-10',
      last_working_date: null,
      employment_type: 'INTERNSHIP',
      work_location: 'Work from Home',
      reporting_manager: 'Manager Test',
      status: 'INTERN',
      created_by: 'usr-hr-admin-01',
      created_at: '2026-01-05T10:00:00Z',
      updated_at: '2026-01-05T10:00:00Z',
    },
  ],

  employee_salary: [
    {
      id: 'sal-test-001',
      employee_id: 'emp-test-001',
      annual_ctc: 500000,
      monthly_gross: 41668,
      basic: 16667,
      hra: 8333,
      communication_allowance: 4167,
      travel_allowance: 4167,
      food_allowance: 4167,
      other_allowances: 4167,
      employee_pf: 1800,
      employer_pf: 1800,
      professional_tax: 200,
      gratuity: 801,
      tds: 0,
      variable_pay: 0,
      net_salary: 37066,
      effective_date: '2025-12-01',
      updated_at: '2025-11-28T10:00:00Z',
    },
    {
      id: 'sal-test-002',
      employee_id: 'emp-test-002',
      annual_ctc: 900000,
      monthly_gross: 75000,
      basic: 30000,
      hra: 15000,
      communication_allowance: 7500,
      travel_allowance: 7500,
      food_allowance: 7500,
      other_allowances: 7500,
      employee_pf: 1800,
      employer_pf: 1800,
      professional_tax: 200,
      gratuity: 1442,
      tds: 2500,
      variable_pay: 50000,
      net_salary: 67258,
      effective_date: '2025-06-15',
      updated_at: '2025-06-10T10:00:00Z',
    },
    {
      id: 'sal-test-003',
      employee_id: 'emp-test-003',
      annual_ctc: 180000,
      monthly_gross: 15000,
      basic: 15000,
      hra: 0,
      communication_allowance: 0,
      travel_allowance: 0,
      food_allowance: 0,
      other_allowances: 0,
      employee_pf: 0,
      employer_pf: 0,
      professional_tax: 0,
      gratuity: 0,
      tds: 0,
      variable_pay: 0,
      net_salary: 15000,
      effective_date: '2026-01-10',
      updated_at: '2026-01-05T10:00:00Z',
    },
  ],

  templates: [
    {
      id: 'tmpl-offer-fulltime',
      template_code: 'TMPL-OFFER-FT',
      name: 'Varsaka Labs Full-Time Offer Letter (16-17 Page Comprehensive)',
      document_type: 'OFFER_LETTER',
      current_version: 'v1.0',
      status: 'PUBLISHED',
      created_by: 'usr-super-admin-01',
      published_by: 'usr-super-admin-01',
      published_at: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'tmpl-exp-letter',
      template_code: 'TMPL-EXP-REL',
      name: 'Varsaka Labs Experience & Relieving Certificate',
      document_type: 'EXPERIENCE_LETTER',
      current_version: 'v1.0',
      status: 'PUBLISHED',
      created_by: 'usr-super-admin-01',
      published_by: 'usr-super-admin-01',
      published_at: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'tmpl-salary-slip',
      template_code: 'TMPL-SAL-SLIP',
      name: 'Varsaka Labs Monthly Payroll Salary Slip',
      document_type: 'SALARY_SLIP',
      current_version: 'v1.0',
      status: 'PUBLISHED',
      created_by: 'usr-super-admin-01',
      published_by: 'usr-super-admin-01',
      published_at: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'tmpl-certificate',
      template_code: 'TMPL-CERT-INT',
      name: 'Varsaka Labs Official Project & Internship Certificate',
      document_type: 'CERTIFICATE',
      current_version: 'v1.0',
      status: 'PUBLISHED',
      created_by: 'usr-super-admin-01',
      published_by: 'usr-super-admin-01',
      published_at: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ],

  documents: [
    {
      id: 'doc-cert-sample-01',
      document_number: 'VAR-CERT-2026-000001',
      verification_id: 'VVR-CERT-7B9A2F',
      document_type: 'CERTIFICATE',
      employee_id: 'emp-test-001',
      employee_name: 'Test Employee 001',
      employee_code: 'VL 1083',
      template_id: 'tmpl-certificate',
      template_version: 'v1.0',
      title: 'Summer Internship & Project Completion Certificate',
      status: 'APPROVED',
      issue_date: '2026-09-06',
      data_snapshot: {
        certificateType: 'INTERNSHIP_COMPLETION',
        candidateName: 'Test Employee 001',
        projectTitle: 'Finance And Marketing Operations',
        mentorName: 'Manager Test',
        performanceGrade: 'Grade 78',
        tenureStartDate: '12 Jun, 2026',
        tenureEndDate: '12 Aug, 2026',
        workLocation: 'New Delhi / Work from Home',
        issueDate: '06 Sep, 2026',
        authorizedSignatory: 'Authorized Signatory, HR Department',
        companyName: 'Varsaka Labs Pvt. Ltd.',
        verificationUrl: 'http://localhost:3000/verify/VVR-CERT-7B9A2F',
      },
      created_by: 'usr-doc-admin-01',
      created_by_name: 'Rohan Deshmukh',
      approved_by: 'usr-super-admin-01',
      approved_by_name: 'Dr. Vikram Sarabhai',
      approved_at: '2026-09-06T12:00:00Z',
      version_number: 1,
      created_at: '2026-09-06T10:00:00Z',
      updated_at: '2026-09-06T12:00:00Z',
    },
    {
      id: 'doc-off-sample-01',
      document_number: 'VAR-OFF-2026-000001',
      verification_id: 'VVR-OFF-3C1E9D',
      document_type: 'OFFER_LETTER',
      employee_id: 'emp-test-001',
      employee_name: 'Test Employee 001',
      employee_code: 'VL 1083',
      template_id: 'tmpl-offer-fulltime',
      template_version: 'v1.0',
      title: 'Full-Time Offer Letter - Finance & Operations Analyst',
      status: 'APPROVED',
      issue_date: '2025-11-28',
      data_snapshot: {
        offerType: 'direct-fulltime',
        offerDate: '2025-11-28',
        candidateName: 'Test Employee 001',
        candidateAddress: 'Plot 1, Block A, Financial District, Hyderabad, Telangana 500032',
        designation: 'Finance & Operations Analyst',
        department: 'Finance & Operations',
        joiningDate: '2025-12-01',
        employeeCode: 'VL 1083',
        annualCtc: 500000,
        annualCtcWords: 'Five Lakh Rupees Only',
        bondPeriodMonths: 24,
        bondPenaltyAmount: 300000,
        noticePeriodMonths: 3,
        basic: 16667,
        hra: 8333,
        communicationAllowance: 4167,
        travelAllowance: 4167,
        foodAllowance: 4167,
        otherAllowances: 4167,
        monthlyGrossSalary: 41668,
        employeePf: 1800,
        employerPf: 1800,
        professionalTax: 200,
        gratuity: 801,
        tds: 0,
        monthlyNetSalary: 37066,
        yearlyVariable: 0,
      },
      created_by: 'usr-hr-admin-01',
      created_by_name: 'Sneha Kulkarni',
      approved_by: 'usr-super-admin-01',
      approved_by_name: 'Dr. Vikram Sarabhai',
      approved_at: '2025-11-28T16:00:00Z',
      version_number: 1,
      created_at: '2025-11-28T14:00:00Z',
      updated_at: '2025-11-28T16:00:00Z',
    },
  ],

  audit_logs: [
    {
      id: 'aud-001',
      user_id: 'usr-super-admin-01',
      user_email: 'admin@varsaka.com',
      action: 'SYSTEM_INITIALIZED',
      resource_type: 'SYSTEM',
      resource_id: 'portal-core',
      metadata: { initialized_modules: ['EMPLOYEE', 'SALARY', 'DOCUMENTS', 'TEMPLATES', 'VERIFICATION'] },
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'aud-002',
      user_id: 'usr-hr-admin-01',
      user_email: 'hr@varsaka.com',
      action: 'EMPLOYEE_CREATED',
      resource_type: 'EMPLOYEE',
      resource_id: 'VL 1083',
      metadata: { name: 'Test Employee 001', designation: 'Finance & Operations Analyst' },
      created_at: '2025-11-28T10:00:00Z',
    },
    {
      id: 'aud-003',
      user_id: 'usr-doc-admin-01',
      user_email: 'docs@varsaka.com',
      action: 'DOCUMENT_APPROVED',
      resource_type: 'DOCUMENT',
      resource_id: 'VAR-CERT-2026-000001',
      metadata: { document_type: 'CERTIFICATE', verification_id: 'VVR-CERT-7B9A2F' },
      created_at: '2026-09-06T12:00:00Z',
    },
  ],

  security_logs: [
    {
      id: 'sec-001',
      event_type: 'SECURITY_AUDIT_BASELINE',
      severity: 'LOW',
      description: 'Enterprise security policies, session encryption, and RLS mechanisms verified active',
      created_at: '2026-01-01T00:00:00Z',
      metadata: { compliance: 'ISO27001 / SOC2 Ready' },
    },
  ],

  verification_logs: [],

  sequences: {
    OFFER_LETTER: 1002,
    EXPERIENCE_LETTER: 1001,
    SALARY_SLIP: 1001,
    CERTIFICATE: 1002,
  },
};

class LocalDatabase {
  private state: DatabaseState;

  constructor() {
    this.state = this.load();
  }

  private load(): DatabaseState {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Error loading local db store:', e);
    }
    this.persist(INITIAL_STATE);
    return INITIAL_STATE;
  }

  private persist(state: DatabaseState) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error persisting local db store:', e);
    }
  }

  public getState(): DatabaseState {
    return this.state;
  }

  public save() {
    this.persist(this.state);
  }

  // Atomic Sequence Generation
  public getNextDocumentNumber(type: DocumentType): string {
    if (!this.state.sequences[type]) {
      this.state.sequences[type] = 1001;
    }
    const currentSeq = this.state.sequences[type]++;
    this.save();
    return formatDocumentNumber(type, currentSeq);
  }
}

export const localDb = new LocalDatabase();
