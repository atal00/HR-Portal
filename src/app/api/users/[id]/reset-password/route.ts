import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await requireAuthUser();

    // Only SUPER_ADMIN can reset other users' passwords
    if (sessionUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only Super Administrator can perform user password resets.' },
        { status: 403 }
      );
    }

    const { id: userId } = await context.params;
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    const resetResult = await db.users.resetPassword(userId, sessionUser.id, sessionUser.email);

    return NextResponse.json({
      success: true,
      message: 'Temporary password generated successfully.',
      tempPassword: resetResult.tempPassword,
      email: resetResult.email,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to reset password.' },
      { status: error.status || 500 }
    );
  }
}
