-- ==============================================================================
-- VARSAKA LABS - HR DOCUMENT MANAGEMENT & VERIFICATION PORTAL
-- Enterprise Production Database Schema (PostgreSQL / Supabase)
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Drop existing tables if needed (Clean rebuild)
DROP TABLE IF EXISTS verification_logs CASCADE;
DROP TABLE IF EXISTS security_logs CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS approvals CASCADE;
DROP TABLE IF EXISTS document_versions CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS template_versions CASCADE;
DROP TABLE IF EXISTS templates CASCADE;
DROP TABLE IF EXISTS employee_salary CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;

-- ==============================================================================
-- 3. RBAC & User Identity Tables
-- ==============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE, -- Maps to Supabase auth.users(id)
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    module VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

-- ==============================================================================
-- 4. Organization & Employee Management
-- ==============================================================================

CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE employee_status AS ENUM ('ACTIVE', 'INTERN', 'ON_NOTICE', 'SEPARATED', 'INACTIVE');

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id VARCHAR(50) NOT NULL UNIQUE, -- e.g., VL 1083
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(50) NOT NULL,
    address TEXT NOT NULL,
    department_id UUID REFERENCES departments(id) ON DELETE RESTRICT,
    designation VARCHAR(150) NOT NULL,
    joining_date DATE NOT NULL,
    last_working_date DATE,
    employment_type VARCHAR(50) NOT NULL DEFAULT 'FULL_TIME', -- FULL_TIME, INTERNSHIP, CONTRACT
    work_location VARCHAR(100) NOT NULL DEFAULT 'Hyderabad, India',
    reporting_manager VARCHAR(255),
    status employee_status NOT NULL DEFAULT 'ACTIVE',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sensitive Salary Data Model (Strictly Restricted via RLS)
CREATE TABLE employee_salary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
    annual_ctc NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    monthly_gross NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    basic NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    hra NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    communication_allowance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    travel_allowance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    food_allowance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    other_allowances NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    employee_pf NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    employer_pf NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    professional_tax NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gratuity NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tds NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    variable_pay NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    net_salary NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 5. Template Engine & Controlled Versioning
-- ==============================================================================

CREATE TYPE document_type_enum AS ENUM ('OFFER_LETTER', 'EXPERIENCE_LETTER', 'SALARY_SLIP', 'CERTIFICATE');
CREATE TYPE template_status_enum AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    document_type document_type_enum NOT NULL,
    current_version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    status template_status_enum NOT NULL DEFAULT 'PUBLISHED',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    published_by UUID REFERENCES users(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    version VARCHAR(20) NOT NULL,
    schema_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    sections JSONB NOT NULL DEFAULT '[]'::jsonb,
    styles_css TEXT,
    change_summary TEXT,
    status template_status_enum NOT NULL DEFAULT 'PUBLISHED',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (template_id, version)
);

-- ==============================================================================
-- 6. Document Generation & Workflow
-- ==============================================================================

CREATE TYPE document_status_enum AS ENUM (
    'DRAFT', 
    'PREVIEW', 
    'VALIDATE', 
    'GENERATE', 
    'PENDING_APPROVAL', 
    'APPROVED', 
    'FINAL', 
    'REJECTED', 
    'REVOKED'
);

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_number VARCHAR(100) NOT NULL UNIQUE, -- Database-backed uniqueness e.g. VAR-OFF-2026-000001
    verification_id VARCHAR(100) NOT NULL UNIQUE, -- Safe public lookup key e.g. VVR-CERT-7B9A2F
    document_type document_type_enum NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    template_id UUID REFERENCES templates(id) ON DELETE RESTRICT,
    template_version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    title VARCHAR(255) NOT NULL,
    status document_status_enum NOT NULL DEFAULT 'DRAFT',
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Dynamic data snapshot preserved permanently
    data_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Storage & File Integrity
    file_path TEXT, -- In private storage bucket
    file_size_bytes BIGINT,
    checksum_sha256 VARCHAR(64),
    
    -- Workflow & Signatures
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    
    -- Revocation Protection
    revoked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    
    version_number INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Document Versioning (Immutable Historical Snapshot upon revision)
CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    document_number VARCHAR(100) NOT NULL,
    verification_id VARCHAR(100) NOT NULL,
    status document_status_enum NOT NULL,
    file_path TEXT,
    data_snapshot JSONB NOT NULL,
    change_reason TEXT NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Document Approvals
CREATE TABLE approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    approver_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    comments TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ
);

-- ==============================================================================
-- 7. Audit, Security, and Verification Logs
-- ==============================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    action VARCHAR(100) NOT NULL, -- e.g., EMPLOYEE_CREATED, DOCUMENT_APPROVED, etc.
    resource_type VARCHAR(50) NOT NULL, -- EMPLOYEE, DOCUMENT, SALARY, TEMPLATE, ROLE
    resource_id VARCHAR(100),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE security_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL, -- AUTH_FAILURE, UNAUTHORIZED_ACCESS, REVOCATION_ATTEMPT
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, CRITICAL
    description TEXT NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE verification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_id VARCHAR(100) NOT NULL,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    status_result VARCHAR(50) NOT NULL, -- VALID, REVOKED, NOT_FOUND
    ip_address VARCHAR(45),
    user_agent TEXT,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 8. High-Performance Indexes
-- ==============================================================================

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_employees_employee_id ON employees(employee_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_department ON employees(department_id);

CREATE INDEX idx_documents_doc_number ON documents(document_number);
CREATE INDEX idx_documents_verification_id ON documents(verification_id);
CREATE INDEX idx_documents_employee ON documents(employee_id);
CREATE INDEX idx_documents_type_status ON documents(document_type, status);

CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

CREATE INDEX idx_security_logs_created ON security_logs(created_at DESC);
CREATE INDEX idx_verification_logs_verif_id ON verification_logs(verification_id);

-- ==============================================================================
-- 9. Row Level Security (RLS) Policies
-- ==============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_salary ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Helper functions for RLS checks (SECURE: explicit search_path prevents schema hijacking)
CREATE OR REPLACE FUNCTION current_app_user_id() RETURNS UUID AS $$
    SELECT id FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION has_permission(user_uuid UUID, required_perm VARCHAR) RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = user_uuid AND p.code = required_perm
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION is_super_admin(user_uuid UUID) RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = user_uuid AND r.code = 'SUPER_ADMIN'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- System & Configuration Read Policies (Authenticated Users)
CREATE POLICY users_select_policy ON users
    FOR SELECT TO authenticated
    USING (
        is_super_admin(current_app_user_id()) OR 
        id = current_app_user_id() OR
        has_permission(current_app_user_id(), 'user.view')
    );

CREATE POLICY roles_select_policy ON roles
    FOR SELECT TO authenticated
    USING (TRUE);

CREATE POLICY permissions_select_policy ON permissions
    FOR SELECT TO authenticated
    USING (TRUE);

CREATE POLICY user_roles_select_policy ON user_roles
    FOR SELECT TO authenticated
    USING (is_super_admin(current_app_user_id()) OR user_id = current_app_user_id());

CREATE POLICY role_permissions_select_policy ON role_permissions
    FOR SELECT TO authenticated
    USING (TRUE);

CREATE POLICY departments_select_policy ON departments
    FOR SELECT TO authenticated
    USING (TRUE);

CREATE POLICY templates_select_policy ON templates
    FOR SELECT TO authenticated
    USING (TRUE);

CREATE POLICY template_versions_select_policy ON template_versions
    FOR SELECT TO authenticated
    USING (TRUE);

CREATE POLICY system_settings_select_policy ON system_settings
    FOR SELECT TO authenticated
    USING (is_super_admin(current_app_user_id()));

-- Employees Table Policies
CREATE POLICY employees_select_policy ON employees
    FOR SELECT TO authenticated
    USING (
        is_super_admin(current_app_user_id()) OR 
        has_permission(current_app_user_id(), 'employee.view')
    );

CREATE POLICY employees_insert_policy ON employees
    FOR INSERT TO authenticated
    WITH CHECK (
        is_super_admin(current_app_user_id()) OR 
        has_permission(current_app_user_id(), 'employee.create')
    );

CREATE POLICY employees_update_policy ON employees
    FOR UPDATE TO authenticated
    USING (
        is_super_admin(current_app_user_id()) OR 
        has_permission(current_app_user_id(), 'employee.update')
    );

-- Salary Table Policies (Restricted exclusively to Payroll and Super Admin)
CREATE POLICY salary_select_policy ON employee_salary
    FOR SELECT TO authenticated
    USING (
        is_super_admin(current_app_user_id()) OR 
        has_permission(current_app_user_id(), 'salary.view')
    );

CREATE POLICY salary_insert_update_policy ON employee_salary
    FOR ALL TO authenticated
    USING (
        is_super_admin(current_app_user_id()) OR 
        has_permission(current_app_user_id(), 'salary.update')
    );

-- Documents Table Policies (STRICT: Document-type isolation, employee.view cannot view salary slips)
CREATE POLICY documents_select_policy ON documents
    FOR SELECT TO authenticated
    USING (
        is_super_admin(current_app_user_id()) OR
        (document_type = 'SALARY_SLIP' AND (
            has_permission(current_app_user_id(), 'salary.view') OR 
            has_permission(current_app_user_id(), 'document.salary.view')
        )) OR
        (document_type = 'OFFER_LETTER' AND has_permission(current_app_user_id(), 'document.offer.view')) OR
        (document_type IN ('EXPERIENCE_LETTER', 'RELIEVING_LETTER') AND has_permission(current_app_user_id(), 'document.experience.view')) OR
        (document_type = 'CERTIFICATE' AND has_permission(current_app_user_id(), 'document.certificate.view'))
    );

CREATE POLICY documents_insert_policy ON documents
    FOR INSERT TO authenticated
    WITH CHECK (
        is_super_admin(current_app_user_id()) OR
        (document_type = 'SALARY_SLIP' AND has_permission(current_app_user_id(), 'document.salary.create')) OR
        (document_type = 'OFFER_LETTER' AND has_permission(current_app_user_id(), 'document.offer.create')) OR
        (document_type IN ('EXPERIENCE_LETTER', 'RELIEVING_LETTER') AND has_permission(current_app_user_id(), 'document.experience.create')) OR
        (document_type = 'CERTIFICATE' AND has_permission(current_app_user_id(), 'document.certificate.create'))
    );

CREATE POLICY document_versions_select_policy ON document_versions
    FOR SELECT TO authenticated
    USING (
        is_super_admin(current_app_user_id()) OR
        EXISTS (
            SELECT 1 FROM documents d 
            WHERE d.id = document_versions.document_id 
              AND (
                (d.document_type = 'SALARY_SLIP' AND (has_permission(current_app_user_id(), 'salary.view') OR has_permission(current_app_user_id(), 'document.salary.view'))) OR
                (d.document_type = 'OFFER_LETTER' AND has_permission(current_app_user_id(), 'document.offer.view')) OR
                (d.document_type IN ('EXPERIENCE_LETTER', 'RELIEVING_LETTER') AND has_permission(current_app_user_id(), 'document.experience.view')) OR
                (d.document_type = 'CERTIFICATE' AND has_permission(current_app_user_id(), 'document.certificate.view'))
              )
        )
    );

CREATE POLICY approvals_select_policy ON approvals
    FOR SELECT TO authenticated
    USING (
        is_super_admin(current_app_user_id()) OR 
        approver_id = current_app_user_id() OR
        has_permission(current_app_user_id(), 'document.offer.approve')
    );

-- Audit & Security Logs (Strict read-only for Authorized Audits)
CREATE POLICY audit_logs_select_policy ON audit_logs
    FOR SELECT TO authenticated
    USING (
        is_super_admin(current_app_user_id()) OR 
        has_permission(current_app_user_id(), 'audit.view')
    );

CREATE POLICY security_logs_select_policy ON security_logs
    FOR SELECT TO authenticated
    USING (
        is_super_admin(current_app_user_id()) OR 
        has_permission(current_app_user_id(), 'security.view')
    );

-- Public Verification Policy (Anonymous can ONLY view safe public verification projection via RPC or constrained select)
CREATE POLICY verification_logs_public_insert ON verification_logs
    FOR INSERT TO anon, authenticated
    WITH CHECK (TRUE);

-- ==============================================================================
-- 10. Seed Default Roles, Permissions, Departments, and Settings
-- ==============================================================================

INSERT INTO roles (code, name, description, is_system) VALUES
('SUPER_ADMIN', 'Super Administrator', 'Full unrestricted enterprise system and security access', TRUE),
('HR_ADMIN', 'HR Administrator', 'Manages employee lifecycles, offers, and experience letters', TRUE),
('DOCUMENT_ADMIN', 'Document Administrator', 'Manages document templates, generation, and certificates', TRUE),
('PAYROLL_ADMIN', 'Payroll Administrator', 'Manages compensation records, salary slips, and payroll', TRUE),
('VIEWER', 'Auditor / Viewer', 'Read-only access to authorized employee and document records', TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, module, description) VALUES
('employee.view', 'View Employees', 'EMPLOYEE', 'Can view employee directory and profiles'),
('employee.create', 'Create Employee', 'EMPLOYEE', 'Can onboard new employees'),
('employee.update', 'Update Employee', 'EMPLOYEE', 'Can modify employee profile records'),

('document.offer.create', 'Generate Offer Letter', 'DOCUMENT', 'Can generate Full-Time and Internship offer letters'),
('document.offer.view', 'View Offer Letter', 'DOCUMENT', 'Can view generated offer letters'),
('document.offer.download', 'Download Offer Letter', 'DOCUMENT', 'Can download official offer letter PDFs'),

('document.experience.create', 'Generate Experience Letter', 'DOCUMENT', 'Can generate relieving and experience letters'),
('document.experience.view', 'View Experience Letter', 'DOCUMENT', 'Can view experience letters'),
('document.experience.download', 'Download Experience Letter', 'DOCUMENT', 'Can download experience letter PDFs'),

('document.salary.create', 'Generate Salary Slip', 'DOCUMENT', 'Can generate monthly employee salary slips'),
('document.salary.view', 'View Salary Slip', 'DOCUMENT', 'Can view salary slips'),
('document.salary.download', 'Download Salary Slip', 'DOCUMENT', 'Can download salary slip PDFs'),

('document.certificate.create', 'Generate Certificate', 'DOCUMENT', 'Can generate official project and internship certificates'),
('document.certificate.view', 'View Certificate', 'DOCUMENT', 'Can view certificates'),
('document.certificate.download', 'Download Certificate', 'DOCUMENT', 'Can download certificate PDFs'),

('template.create', 'Create Template', 'TEMPLATE', 'Can draft new document templates'),
('template.update', 'Update Template', 'TEMPLATE', 'Can modify existing document template sections'),
('template.publish', 'Publish Template', 'TEMPLATE', 'Can publish approved template versions'),

('salary.view', 'View Sensitive Salary Data', 'SALARY', 'Can inspect confidential compensation and CTC'),
('salary.update', 'Modify Salary Data', 'SALARY', 'Can modify compensation and payroll structures'),

('user.create', 'Create User', 'ADMIN', 'Can invite and create portal users'),
('user.update', 'Update User', 'ADMIN', 'Can update portal user accounts and status'),

('role.assign', 'Assign Roles', 'RBAC', 'Can grant or revoke roles from users'),
('permission.assign', 'Assign Permissions', 'RBAC', 'Can configure role permissions'),

('audit.view', 'View Audit Logs', 'AUDIT', 'Can view full immutable audit trails'),
('security.view', 'View Security Logs', 'SECURITY', 'Can review security logs and incident reports')
ON CONFLICT (code) DO NOTHING;

-- Map Default Permissions to Roles
-- SUPER_ADMIN gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;

-- HR_ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'HR_ADMIN' AND p.code IN (
    'employee.view', 'employee.create', 'employee.update',
    'document.offer.create', 'document.offer.view', 'document.offer.download',
    'document.experience.create', 'document.experience.view', 'document.experience.download',
    'document.certificate.create', 'document.certificate.view', 'document.certificate.download'
)
ON CONFLICT DO NOTHING;

-- DOCUMENT_ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'DOCUMENT_ADMIN' AND p.code IN (
    'employee.view',
    'document.offer.create', 'document.offer.view', 'document.offer.download',
    'document.experience.create', 'document.experience.view', 'document.experience.download',
    'document.certificate.create', 'document.certificate.view', 'document.certificate.download',
    'template.create', 'template.update', 'template.publish'
)
ON CONFLICT DO NOTHING;

-- PAYROLL_ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'PAYROLL_ADMIN' AND p.code IN (
    'employee.view',
    'salary.view', 'salary.update',
    'document.salary.create', 'document.salary.view', 'document.salary.download'
)
ON CONFLICT DO NOTHING;

-- VIEWER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'VIEWER' AND p.code IN (
    'employee.view',
    'document.offer.view',
    'document.experience.view',
    'document.certificate.view'
)
ON CONFLICT DO NOTHING;

-- Seed Default Departments
INSERT INTO departments (name, code, description) VALUES
('Engineering & Technology', 'ENG', 'Software Engineering, QA, AI & Cloud Infrastructure'),
('Finance & Operations', 'FIN_OPS', 'Financial Analysis, Accounting, and Business Operations'),
('Human Resources', 'HR', 'Talent Acquisition, People Operations, and Compliance'),
('Product & Design', 'PROD_DES', 'Product Management, UI/UX Design, and Research'),
('Marketing & Growth', 'MKTG', 'Brand Strategy, Digital Marketing, and Client Relations')
ON CONFLICT (name) DO NOTHING;

-- Seed System Settings
INSERT INTO system_settings (key, value, description) VALUES
('company_info', '{
    "company_name": "Varsaka Labs",
    "legal_entity": "Varsaka Labs",
    "website": "https://varsaka.com",
    "email": "info@varsakalabs.com",
    "phone": "+91 40 6000 0000",
    "address": "APHB Colony, JV Colony, Indira Nagar, Gachibowli, Hyderabad, Telangana 500032",
    "signatory_title": "Authorized Signatory",
    "signatory_department": "HR Department"
}'::jsonb, 'Official Varsaka corporate metadata used in documents'),
('numbering_sequences', '{
    "OFFER_LETTER": { "prefix": "VAR-OFF", "next_number": 1001 },
    "EXPERIENCE_LETTER": { "prefix": "VAR-EXP", "next_number": 1001 },
    "SALARY_SLIP": { "prefix": "VAR-SAL", "next_number": 1001 },
    "CERTIFICATE": { "prefix": "VAR-CERT", "next_number": 1001 }
}'::jsonb, 'Atomic document numbering sequence tracker')
ON CONFLICT (key) DO NOTHING;
