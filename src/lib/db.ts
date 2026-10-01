import { localDb } from './storage/mock-db';
import { isSupabaseConfigured, isProductionEnv } from './supabase';
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
  VerificationLog,
  PublicVerificationResult
} from '@/types/database';
import { generateVerificationId } from './id-generator';

function assertDatastoreMode() {
  if (isProductionEnv() && !isSupabaseConfigured()) {
    throw new Error(
      'FATAL PRODUCTION SECURITY ERROR: Production deployment requires connected Supabase PostgreSQL instance. Silent fallback to local storage is blocked.'
    );
  }
}

export const db = {
  users: {
    async list(): Promise<User[]> {
      assertDatastoreMode();
      return localDb.getState().users;
    },
    async getById(id: string): Promise<User | null> {
      assertDatastoreMode();
      return localDb.getState().users.find((u) => u.id === id) || null;
    },
    async getByEmail(email: string): Promise<User | null> {
      return localDb.getState().users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
    },
    async updateStatus(id: string, isActive: boolean): Promise<User> {
      const state = localDb.getState();
      const user = state.users.find((u) => u.id === id);
      if (!user) throw new Error('User not found');
      user.is_active = isActive;
      user.updated_at = new Date().toISOString();
      localDb.save();
      return user;
    }
  },

  departments: {
    async list(): Promise<Department[]> {
      return localDb.getState().departments;
    },
    async getById(id: string): Promise<Department | null> {
      return localDb.getState().departments.find((d) => d.id === id) || null;
    }
  },

  employees: {
    async list(filters?: { search?: string; status?: string; departmentId?: string }): Promise<Employee[]> {
      let list = [...localDb.getState().employees];
      if (filters?.status && filters.status !== 'ALL') {
        list = list.filter((e) => e.status === filters.status);
      }
      if (filters?.departmentId && filters.departmentId !== 'ALL') {
        list = list.filter((e) => e.department_id === filters.departmentId);
      }
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        list = list.filter((e) => 
          e.full_name.toLowerCase().includes(q) ||
          e.employee_id.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q) ||
          e.designation.toLowerCase().includes(q)
        );
      }
      return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async getById(id: string): Promise<Employee | null> {
      return localDb.getState().employees.find((e) => e.id === id || e.employee_id === id) || null;
    },

    async create(data: Omit<Employee, 'id' | 'created_at' | 'updated_at'>): Promise<Employee> {
      const state = localDb.getState();
      
      // Enforce unique employee ID and email
      const existingId = state.employees.find((e) => e.employee_id.toLowerCase() === data.employee_id.toLowerCase());
      if (existingId) throw new Error(`Employee ID "${data.employee_id}" already exists.`);

      const existingEmail = state.employees.find((e) => e.email.toLowerCase() === data.email.toLowerCase());
      if (existingEmail) throw new Error(`Email address "${data.email}" is already registered to another employee.`);

      const dept = state.departments.find((d) => d.id === data.department_id);

      const newEmp: Employee = {
        ...data,
        id: `emp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        department_name: dept?.name || 'General',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      state.employees.unshift(newEmp);
      localDb.save();
      return newEmp;
    },

    async update(id: string, data: Partial<Employee>): Promise<Employee> {
      const state = localDb.getState();
      const emp = state.employees.find((e) => e.id === id);
      if (!emp) throw new Error('Employee not found');

      if (data.department_id && data.department_id !== emp.department_id) {
        const dept = state.departments.find((d) => d.id === data.department_id);
        emp.department_name = dept?.name || emp.department_name;
      }

      Object.assign(emp, data, { updated_at: new Date().toISOString() });
      localDb.save();
      return emp;
    }
  },

  salary: {
    async getByEmployeeId(employeeId: string): Promise<EmployeeSalary | null> {
      const state = localDb.getState();
      return state.employee_salary.find((s) => s.employee_id === employeeId) || null;
    },

    async upsert(data: Omit<EmployeeSalary, 'id' | 'updated_at'>): Promise<EmployeeSalary> {
      const state = localDb.getState();
      let record = state.employee_salary.find((s) => s.employee_id === data.employee_id);

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
      return record;
    }
  },

  documents: {
    async list(filters?: { type?: string; status?: string; employeeId?: string; search?: string }): Promise<DocumentRecord[]> {
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
      if (filters?.search) {
        const q = filters.search.toLowerCase();
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
      return localDb.getState().documents.find((d) => d.id === id || d.document_number === id) || null;
    },

    async getByVerificationId(vId: string): Promise<DocumentRecord | null> {
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
      const state = localDb.getState();
      const emp = state.employees.find((e) => e.id === data.employee_id);
      if (!emp) throw new Error('Associated employee record not found.');

      // Atomic sequential generation
      const document_number = localDb.getNextDocumentNumber(data.document_type);
      const verification_id = generateVerificationId(data.document_type);

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
        data_snapshot: data.data_snapshot,
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
      const state = localDb.getState();
      const doc = state.documents.find((d) => d.id === id);
      if (!doc) throw new Error('Document not found');
      if (doc.status === 'REVOKED') throw new Error('Revoked document cannot be approved.');

      doc.status = 'APPROVED';
      doc.approved_by = approverId;
      doc.approved_by_name = approverName;
      doc.approved_at = new Date().toISOString();
      doc.updated_at = new Date().toISOString();

      localDb.save();
      return doc;
    },

    async reject(id: string, reviewerId: string, reviewerName: string, reason: string): Promise<DocumentRecord> {
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
      const state = localDb.getState();
      const doc = state.documents.find((d) => d.id === id);
      if (!doc) throw new Error('Document not found');

      if (!reason || reason.trim().length < 5) {
        throw new Error('Revocation requires a detailed, valid business reason.');
      }

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
      const state = localDb.getState();
      const existing = state.documents.find((d) => d.id === docId);
      if (!existing) throw new Error('Original document not found');

      // Do NOT overwrite approved document. Create a new immutable version record!
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
    }
  },

  templates: {
    async list(): Promise<TemplateRecord[]> {
      return localDb.getState().templates;
    },
    async getById(id: string): Promise<TemplateRecord | null> {
      return localDb.getState().templates.find((t) => t.id === id) || null;
    }
  },

  verification: {
    async verifyPublic(verificationId: string, ip?: string, userAgent?: string): Promise<PublicVerificationResult> {
      const state = localDb.getState();
      const doc = state.documents.find((d) => d.verification_id.toUpperCase() === verificationId.trim().toUpperCase());

      const resultStatus = !doc ? 'NOT_FOUND' : (doc.status === 'REVOKED' ? 'REVOKED' : 'VALID');

      // Log verification attempt (safe event logging without private metadata)
      state.verification_logs.unshift({
        id: `vlog-${Date.now()}`,
        verification_id: verificationId,
        document_id: doc?.id,
        status_result: resultStatus,
        ip_address: ip || '127.0.0.1',
        user_agent: userAgent || 'Public-Browser',
        verified_at: new Date().toISOString(),
      });
      localDb.save();

      if (!doc) {
        return {
          status: 'NOT_FOUND',
          verification_id: verificationId,
          verified_at: new Date().toISOString(),
        };
      }

      if (doc.status === 'REVOKED') {
        return {
          status: 'REVOKED',
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

      // Safe public response ONLY (NO PAN, Bank, Salary, Private Address, Phone, Email, Internal notes)
      return {
        status: 'VALID',
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
    async list(limit: number = 100): Promise<AuditLog[]> {
      return localDb.getState().audit_logs.slice(0, limit);
    }
  },

  securityLogs: {
    async list(limit: number = 100): Promise<SecurityLog[]> {
      return localDb.getState().security_logs.slice(0, limit);
    }
  }
};
