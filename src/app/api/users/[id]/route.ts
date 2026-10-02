import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { RoleCode } from '@/types/database';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await requireAuthUser();
    const { id } = await params;

    if (sessionUser.role !== 'SUPER_ADMIN' && sessionUser.id !== id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const targetUser = await db.users.getById(id);
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const permissions = await db.users.getPermissions(id);

    return NextResponse.json({
      success: true,
      user: targetUser,
      permissions,
    });
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
    const sessionUser = await requireAuthUser();
    const { id } = await params;

    // Only SUPER_ADMIN can modify user attributes
    if (sessionUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only Super Administrator can modify users.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { role, department, is_active, deactivation_reason } = body;

    let targetUser = await db.users.getById(id);
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const isTargetSuperAdmin = targetUser.role === 'SUPER_ADMIN' || targetUser.email.toLowerCase() === 'admin@in.varsaka.com' || targetUser.email.toLowerCase() === 'admin@varsaka.com';

    // 1. Role update validation
    if (role !== undefined) {
      if (isTargetSuperAdmin && role !== 'SUPER_ADMIN') {
        return NextResponse.json(
          { error: 'Forbidden: Super Administrator role is immutable and cannot be downgraded, replaced, or removed.' },
          { status: 403 }
        );
      }
      if (sessionUser.id === id && role !== sessionUser.role) {
        return NextResponse.json(
          { error: 'Forbidden: Self-demotion of administrative authority is strictly prohibited.' },
          { status: 403 }
        );
      }

      const validRoles: RoleCode[] = ['SUPER_ADMIN', 'HR_ADMIN', 'DOCUMENT_ADMIN', 'PAYROLL_ADMIN', 'VIEWER'];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
      }
      targetUser = await db.users.updateRole(id, role, sessionUser.id, sessionUser.email);
    }

    // 2. Department update validation
    if (department !== undefined) {
      if (isTargetSuperAdmin) {
        return NextResponse.json(
          { error: 'Forbidden: Super Administrator department is protected and cannot be changed through the User Directory.' },
          { status: 403 }
        );
      }
      targetUser = await db.users.updateDepartment(id, department, sessionUser.id, sessionUser.email);
    }

    // 3. Activation / Deactivation update validation
    if (is_active !== undefined) {
      if (is_active === false) {
        if (isTargetSuperAdmin) {
          return NextResponse.json(
            { error: 'Forbidden: Super Administrator account is protected and cannot be deactivated.' },
            { status: 403 }
          );
        }
        if (sessionUser.id === id) {
          return NextResponse.json(
            { error: 'Forbidden: Self-deactivation of administrative authority is strictly prohibited.' },
            { status: 403 }
          );
        }
        if (!deactivation_reason || !deactivation_reason.trim()) {
          return NextResponse.json(
            { error: 'Mandatory reason required to deactivate a system user.' },
            { status: 400 }
          );
        }
      }

      targetUser = await db.users.updateStatusWithReason(
        id,
        Boolean(is_active),
        deactivation_reason?.trim(),
        sessionUser.id,
        sessionUser.email
      );
    }

    return NextResponse.json({ success: true, user: targetUser });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await requireAuthUser();
    const { id } = await params;

    if (sessionUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only Super Administrator can delete users.' },
        { status: 403 }
      );
    }

    const targetUser = await db.users.getById(id);
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const isTargetSuperAdmin = targetUser.role === 'SUPER_ADMIN' || targetUser.email.toLowerCase() === 'admin@in.varsaka.com' || targetUser.email.toLowerCase() === 'admin@varsaka.com';
    if (isTargetSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Super Administrator account is protected and cannot be deleted.' },
        { status: 403 }
      );
    }

    if (sessionUser.id === id) {
      return NextResponse.json(
        { error: 'Forbidden: Self-deletion of administrative account is strictly prohibited.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const reason = body?.reason;

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return NextResponse.json(
        { error: 'Mandatory reason is required for system user deletion.' },
        { status: 400 }
      );
    }

    const deleted = await db.users.deleteUser(id, reason.trim(), sessionUser.id, sessionUser.email);
    return NextResponse.json({ success: true, user: deleted });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}
