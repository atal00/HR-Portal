import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/rbac';
import { logAuditEvent, logSecurityEvent } from '@/lib/audit';
import { TaskPriority, TaskStatus } from '@/types/database';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthUser();
    const { id } = await params;

    const task = await db.tasks.getById(id);
    if (!task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }

    // RBAC: Super Admin, HR Admin, assignee, or creator can view
    const isPrivileged = user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN';
    const isParty = task.assigned_to === user.id || task.created_by === user.id;

    if (!isPrivileged && !isParty) {
      return NextResponse.json({ error: 'Forbidden: You do not have access to this task.' }, { status: 403 });
    }

    return NextResponse.json({ success: true, task });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthUser();
    const { id } = await params;

    const task = await db.tasks.getById(id);
    if (!task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }

    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const isHrAdmin = user.role === 'HR_ADMIN';
    const isAssignee = task.assigned_to === user.id;
    const isCreator = task.created_by === user.id;

    // Must be either privileged, assignee, or creator
    if (!isSuperAdmin && !isHrAdmin && !isAssignee && !isCreator) {
      await logSecurityEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        severity: 'HIGH',
        description: `User ${user.email} attempted to update task ${id} without permission.`,
        userId: user.id,
      });
      return NextResponse.json({ error: 'Forbidden: You do not have permission to update this task.' }, { status: 403 });
    }

    const body = await req.json();
    const { status, priority, description, due_date, assign_to } = body;

    const updates: Record<string, any> = {};

    // 1. Status Update
    if (status !== undefined) {
      const validStatuses: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status '${status}'. Allowed: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }

      // Cancellation requires creator, HR Admin, or Super Admin
      if (status === 'CANCELLED' && !isSuperAdmin && !isHrAdmin && !isCreator) {
        return NextResponse.json(
          { error: 'Forbidden: Only the task creator or administrator can cancel a task.' },
          { status: 403 }
        );
      }

      updates.status = status;
    }

    // 2. Reassignment
    if (assign_to !== undefined) {
      let targetAssigneeId = assign_to;
      if (assign_to && assign_to.toLowerCase() === 'me') {
        targetAssigneeId = user.id;
      }

      if (targetAssigneeId !== task.assigned_to) {
        // Can reassign if Super Admin or has task.assign (like HR Admin), or creator self-assigning
        const canReassign = isSuperAdmin || hasPermission(user, 'task.assign') || (isCreator && targetAssigneeId === user.id);
        if (!canReassign) {
          return NextResponse.json(
            { error: 'Forbidden: You do not have permission to reassign this task.' },
            { status: 403 }
          );
        }

        const targetUser = await db.users.getById(targetAssigneeId);
        if (!targetUser) {
          return NextResponse.json({ error: 'Target assignee not found.' }, { status: 404 });
        }

        updates.assigned_to = targetAssigneeId;
      }
    }

    // 3. Priority & Metadata
    if (priority !== undefined) {
      const validPriorities: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
      if (!validPriorities.includes(priority)) {
        return NextResponse.json(
          { error: `Invalid priority '${priority}'. Allowed: ${validPriorities.join(', ')}` },
          { status: 400 }
        );
      }
      updates.priority = priority;
    }

    if (description !== undefined) {
      updates.description = description ? String(description).trim() : null;
    }

    if (due_date !== undefined) {
      updates.due_date = due_date || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true, task });
    }

    const updatedTask = await db.tasks.update(id, updates);

    // Audit Logging
    if (updates.status && updates.status !== task.status) {
      let action = 'TASK_STATUS_CHANGED';
      if (updates.status === 'COMPLETED') action = 'TASK_COMPLETED';
      if (updates.status === 'CANCELLED') action = 'TASK_CANCELLED';

      await logAuditEvent({
        userId: user.id,
        userEmail: user.email,
        action,
        resourceType: 'TASK',
        resourceId: task.id,
        metadata: {
          task_id: task.id,
          previous_status: task.status,
          new_status: updates.status,
          actor_id: user.id,
        },
      });
    }

    if (updates.assigned_to && updates.assigned_to !== task.assigned_to) {
      await logAuditEvent({
        userId: user.id,
        userEmail: user.email,
        action: 'TASK_REASSIGNED',
        resourceType: 'TASK',
        resourceId: task.id,
        metadata: {
          task_id: task.id,
          previous_assignee: task.assigned_to,
          new_assignee: updates.assigned_to,
          reassigned_by: user.id,
        },
      });
    }

    return NextResponse.json({
      success: true,
      task: updatedTask,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}
