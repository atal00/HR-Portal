-- ==============================================================================
-- VARSAKA LABS - HR DOCUMENT MANAGEMENT & VERIFICATION PORTAL
-- Tasks & Internal Workflow Schema Migration
-- ==============================================================================

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    assigned_to UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    status VARCHAR(20) NOT NULL DEFAULT 'TODO' CHECK (status IN ('TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED')),
    due_date TIMESTAMPTZ,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_employee_id ON tasks(employee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_document_id ON tasks(document_id);

-- Enable Row Level Security
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- 1. Super Admin Full Access Policy
DROP POLICY IF EXISTS "tasks_super_admin_all" ON tasks;
CREATE POLICY "tasks_super_admin_all" ON tasks
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
            AND r.code = 'SUPER_ADMIN'
        )
    );

-- 2. View Policy: Users can view tasks assigned to them, created by them, or if Super/HR Admin
DROP POLICY IF EXISTS "tasks_select_policy" ON tasks;
CREATE POLICY "tasks_select_policy" ON tasks
    FOR SELECT
    TO authenticated
    USING (
        assigned_to = (SELECT id FROM users WHERE auth_user_id = auth.uid())
        OR created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
            AND r.code IN ('SUPER_ADMIN', 'HR_ADMIN')
        )
    );

-- 3. Insert Policy: Authenticated users can insert tasks if created_by matches their user id
DROP POLICY IF EXISTS "tasks_insert_policy" ON tasks;
CREATE POLICY "tasks_insert_policy" ON tasks
    FOR INSERT
    TO authenticated
    WITH CHECK (
        created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    );

-- 4. Update Policy: Assignee, creator, or Super/HR Admin can update tasks
DROP POLICY IF EXISTS "tasks_update_policy" ON tasks;
CREATE POLICY "tasks_update_policy" ON tasks
    FOR UPDATE
    TO authenticated
    USING (
        assigned_to = (SELECT id FROM users WHERE auth_user_id = auth.uid())
        OR created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
            AND r.code IN ('SUPER_ADMIN', 'HR_ADMIN')
        )
    );
