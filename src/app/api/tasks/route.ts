import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/rbac';
import { logAuditEvent, logSecurityEvent } from '@/lib/audit';
import { TaskPriority, TaskStatus } from '@/types/database';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthUser();

    if (!hasPermission(user, 'task.view')) {
      return NextResponse.json({ error: 'Forbidden: Missing task.view permission.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view') || 'my'; // 'my' | 'assigned_by_me' | 'all'
    const status = searchParams.get('status') as TaskStatus | null;
    const priority = searchParams.get('priority') as TaskPriority | null;
    const search = searchParams.get('search') || undefined;

    const isPrivileged = user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN';

    let assigned_to: string | undefined = undefined;
    let created_by: string | undefined = undefined;

    if (view === 'my') {
      assigned_to = user.id;
    } else if (view === 'assigned_by_me') {
      created_by = user.id;
    } else if (view === 'all') {
      if (!isPrivileged) {
        // Non-privileged users requesting 'all' only get tasks they are involved with
        assigned_to = user.id;
      }
    }

    const tasks = await db.tasks.list({
      assigned_to,
      created_by,
      status: status || undefined,
      priority: priority || undefined,
      search,
    });

    const summary = await db.tasks.getSummary(user.id);

    return NextResponse.json({
      success: true,
      tasks,
      summary,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthUser();

    if (!hasPermission(user, 'task.create')) {
      await logSecurityEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        severity: 'MEDIUM',
        description: `User ${user.email} attempted to create a task without task.create permission.`,
        userId: user.id,
      });
      return NextResponse.json({ error: 'Forbidden: Missing task.create permission.' }, { status: 403 });
    }

    const body = await req.json();
    const {
      title,
      description,
      assign_to,
      priority = 'MEDIUM',
      due_date,
      employee_id,
      document_id,
    } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Task title is required.' }, { status: 400 });
    }

    // Resolve target assignee: 'me', 'Me', or target user ID
    let targetAssigneeId = user.id;
    if (assign_to && assign_to.toLowerCase() !== 'me') {
      targetAssigneeId = assign_to;
    }

    // Server-side assignment authorization check
    if (targetAssigneeId !== user.id) {
      const canAssign = user.role === 'SUPER_ADMIN' || hasPermission(user, 'task.assign');
      if (!canAssign) {
        await logSecurityEvent({
          eventType: 'UNAUTHORIZED_ACCESS',
          severity: 'HIGH',
          description: `User ${user.email} attempted to assign a task to another user without task.assign permission.`,
          userId: user.id,
        });
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to assign tasks to other users.' },
          { status: 403 }
        );
      }

      // Verify target assignee user exists
      const targetUser = await db.users.getById(targetAssigneeId);
      if (!targetUser) {
        return NextResponse.json({ error: 'Target assignee user not found.' }, { status: 404 });
      }
    }

    const validPriorities: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    if (!validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: `Invalid priority '${priority}'. Allowed: ${validPriorities.join(', ')}` },
        { status: 400 }
      );
    }

    const task = await db.tasks.create({
      title: title.trim(),
      description: description ? String(description).trim() : null,
      assigned_to: targetAssigneeId,
      created_by: user.id,
      priority,
      status: 'TODO',
      due_date: due_date || null,
      employee_id: employee_id || null,
      document_id: document_id || null,
    });

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      action: 'TASK_CREATED',
      resourceType: 'TASK',
      resourceId: task.id,
      metadata: {
        task_id: task.id,
        title: task.title,
        assigned_to: task.assigned_to,
        created_by: task.created_by,
        priority: task.priority,
        status: task.status,
      },
    });

    if (task.assigned_to !== user.id) {
      await logAuditEvent({
        userId: user.id,
        userEmail: user.email,
        action: 'TASK_ASSIGNED',
        resourceType: 'TASK',
        resourceId: task.id,
        metadata: {
          task_id: task.id,
          assigned_to: task.assigned_to,
          assigned_by: user.id,
        },
      });
    }

    return NextResponse.json({
      success: true,
      task,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}
