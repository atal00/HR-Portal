import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ verificationId: string }> }
) {
  try {
    const { verificationId } = await params;
    if (!verificationId) {
      return NextResponse.json({ status: 'NOT_FOUND', error: 'Missing verification ID' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    const result = await db.verification.verifyPublic(verificationId, ip, userAgent);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ status: 'NOT_FOUND', error: error.message }, { status: 500 });
  }
}
