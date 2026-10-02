import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await requireAuthUser();
    const { id } = await params;

    // ONLY SUPER_ADMIN is authorized to approve or reject certificate access requests
    if (sessionUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only Super Administrator can review certificate access requests.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action, reason } = body;

    if (action === 'APPROVE') {
      const updated = await db.certificateRequests.approve(id, sessionUser.id);
      return NextResponse.json({ success: true, request: updated });
    } else if (action === 'REJECT') {
      if (!reason || typeof reason !== 'string' || !reason.trim()) {
        return NextResponse.json(
          { error: 'Mandatory reason is required to reject certificate access request.' },
          { status: 400 }
        );
      }
      const updated = await db.certificateRequests.reject(id, sessionUser.id, reason.trim());
      return NextResponse.json({ success: true, request: updated });
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
