-- ==============================================================================
-- VARSAKA LABS HR PORTAL - 2026 PRODUCTION DATABASE MIGRATION
-- Master Migration: Employee Master Data, System User Lifecycle & Deletion Hardening
-- ==============================================================================

-- 1. EMPLOYEE MASTER DATA & LIFECYCLE EXTENSIONS (public.employees)
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS deletion_status VARCHAR(30) DEFAULT 'NONE';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS deletion_reason TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS deletion_requested_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS deletion_approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS deletion_approved_at TIMESTAMPTZ;

-- Section A: Personal Information
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS father_name VARCHAR(255);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS mother_name VARCHAR(255);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS personal_email VARCHAR(255);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS alternate_phone VARCHAR(50);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS permanent_address TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS current_address TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS state VARCHAR(100);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'India';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pin_code VARCHAR(20);

-- Section B: Identity / Statutory Information
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pan_number VARCHAR(20);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS aadhaar_number VARCHAR(30);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS passport_number VARCHAR(50);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS uan VARCHAR(50);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pf_number VARCHAR(50);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS esic_number VARCHAR(50);

-- Section C: Employment Information
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS probation_period VARCHAR(50);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS confirmation_date DATE;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS notice_period VARCHAR(50);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS date_of_separation DATE;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS separation_reason TEXT;

-- Section D: Bank Information
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS bank_account_holder_name VARCHAR(255);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS bank_ifsc VARCHAR(30);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS salary_structure VARCHAR(50);

-- Section E: Document / KYC Storage References
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS kyc_documents JSONB DEFAULT '{}'::jsonb;

-- 2. EMPLOYEE SALARY EXTENSIONS (public.employee_salary)
ALTER TABLE public.employee_salary ADD COLUMN IF NOT EXISTS pan_number VARCHAR(20);
ALTER TABLE public.employee_salary ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
ALTER TABLE public.employee_salary ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50);
ALTER TABLE public.employee_salary ADD COLUMN IF NOT EXISTS pf_number VARCHAR(50);
ALTER TABLE public.employee_salary ADD COLUMN IF NOT EXISTS special_allowance NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.employee_salary ADD COLUMN IF NOT EXISTS conveyance NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.employee_salary ADD COLUMN IF NOT EXISTS esic NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.employee_salary ADD COLUMN IF NOT EXISTS other_deductions NUMERIC(12,2) DEFAULT 0;

-- 3. SYSTEM USER LIFECYCLE & SECURITY EXTENSIONS (public.users)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS temp_password_expires_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deletion_status VARCHAR(30) DEFAULT 'NONE';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- 4. PERFORMANCE & INTEGRITY INDEXES
CREATE INDEX IF NOT EXISTS idx_employees_deletion_status ON public.employees(deletion_status);
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON public.employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_email ON public.employees(email);
CREATE INDEX IF NOT EXISTS idx_users_deletion_status ON public.users(deletion_status);
CREATE INDEX IF NOT EXISTS idx_users_must_change_password ON public.users(must_change_password);

-- 5. RELOAD POSTGREST SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
