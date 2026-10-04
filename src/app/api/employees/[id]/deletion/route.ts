import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/rbac';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await requireAuthUser();
    const { id } = await params;

    if (!hasPermission(sessionUser, 'employee.view')) {
      return NextResponse.json({
        success: false,
        canPurge: false,
        tasksTableAvailable: false,
        error: 'Forbidden: Missing employee.view permission.',
        blockingReason: 'Forbidden: Missing employee.view permission.'
      }, { status: 403 });
    }

    const dependencies = await db.employees.getDeletionDependencies(id);
    return NextResponse.json({ success: true, ...dependencies });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        canPurge: false,
        tasksTableAvailable: false,
        error: error.message || 'Internal Server Error',
        blockingReason: error.message || 'Failed to verify deletion prerequisites.'
      },
      { status: error.status || 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await requireAuthUser();
    const { id } = await params;

    // Authorized users can request employee deletion
    const canRequest = hasPermission(sessionUser, 'employee.delete') || 
                       sessionUser.role === 'SUPER_ADMIN' || 
                       sessionUser.role === 'HR_ADMIN';

    if (!canRequest) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient privileges to request employee deletion.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const reason = body?.reason;

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return NextResponse.json(
        { error: 'Mandatory reason is required to request employee deletion.' },
        { status: 400 }
      );
    }

    const updatedEmployee = await db.employees.requestDeletion(id, reason.trim(), sessionUser.id, sessionUser.email);
    return NextResponse.json({ success: true, employee: updatedEmployee });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await requireAuthUser();
    const { id } = await params;

    // ONLY SUPER_ADMIN is authorized to approve or reject employee deletion requests
    if (sessionUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only Super Administrator can approve or reject employee deletions.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action, reason } = body;

    if (action === 'APPROVE') {
      const updatedEmployee = await db.employees.approveDeletion(id, sessionUser.id, sessionUser.email);
      return NextResponse.json({ success: true, employee: updatedEmployee });
    } else if (action === 'REJECT') {
      if (!reason || typeof reason !== 'string' || !reason.trim()) {
        return NextResponse.json(
          { error: 'Mandatory reason is required to reject employee deletion.' },
          { status: 400 }
        );
      }
      const updatedEmployee = await db.employees.rejectDeletion(id, sessionUser.id, reason.trim(), sessionUser.email);
      return NextResponse.json({ success: true, employee: updatedEmployee });
    } else {
      return NextResponse.json(
        { error: "Invalid action. Expected 'APPROVE' or 'REJECT'." },
        { status: 400 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}
