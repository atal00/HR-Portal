import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const sessionUser = await requireAuthUser();

    // SUPER_ADMIN sees all requests; regular users can only see requests created by themselves
    const allRequests = await db.certificateRequests.list();
    if (sessionUser.role === 'SUPER_ADMIN') {
      return NextResponse.json({ success: true, requests: allRequests });
    }

    const myRequests = allRequests.filter(r => r.user_id === sessionUser.id);
    return NextResponse.json({ success: true, requests: myRequests });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await requireAuthUser();

    // Check if user already has an active pending request
    const existing = await db.certificateRequests.list();
    const pending = existing.find(r => r.user_id === sessionUser.id && r.status === 'PENDING');
    if (pending) {
      return NextResponse.json(
        { error: 'You already have a pending certificate access request under review.' },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const newRequest = await db.certificateRequests.create({
      user_id: sessionUser.id,
      user_name: sessionUser.full_name || 'System User',
      user_email: sessionUser.email,
      department: sessionUser.department || 'General',
      requested_permission: body?.requested_permission || 'Certificate Generation',
    });

    return NextResponse.json({ success: true, request: newRequest }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}
