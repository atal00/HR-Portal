import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rateLimiter } from '@/lib/rate-limit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ verificationId: string }> }
) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    
    // Rate limit: max 15 verification lookups per minute per IP
    const rateCheck = rateLimiter.check(`verify:${ip}`, 15, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { 
          status: 'RATE_LIMITED', 
          error: `Verification rate limit exceeded. Please wait ${rateCheck.resetSeconds} seconds before trying again.` 
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateCheck.resetSeconds),
          }
        }
      );
    }

    const { verificationId } = await params;
    if (!verificationId) {
      return NextResponse.json({ status: 'NOT_FOUND', error: 'Missing verification ID' }, { status: 400 });
    }

    const userAgent = req.headers.get('user-agent') || 'Browser';

    const result = await db.verification.verifyPublic(verificationId, ip, userAgent);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ status: 'NOT_FOUND', error: error.message }, { status: 500 });
  }
}

