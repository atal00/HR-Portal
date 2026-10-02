import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAuthUser } from '@/lib/auth';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { ASSETS_BUCKET } from '@/lib/branding';

export async function GET(req: NextRequest) {
  try {
    // Require authenticated user to prevent anonymous public access to private signatures/stamps
    await requireAuthUser();

    const { searchParams } = new URL(req.url);
    const assetPath = searchParams.get('path');

    if (!assetPath) {
      return new NextResponse('Asset path is required.', { status: 400 });
    }

    // Security: sanitize path against traversal attacks
    if (assetPath.includes('..') || assetPath.includes('\\')) {
      return new NextResponse('Invalid asset path.', { status: 400 });
    }

    if (!assetPath.startsWith('signatures/') && !assetPath.startsWith('stamps/')) {
      return new NextResponse('Forbidden asset folder.', { status: 403 });
    }

    const ext = path.extname(assetPath).toLowerCase();
    const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

    if (process.env.STORAGE_MODE === 'supabase') {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase.storage
        .from(ASSETS_BUCKET)
        .download(assetPath);

      if (error || !data) {
        return new NextResponse('Asset not found.', { status: 404 });
      }

      const buffer = Buffer.from(await data.arrayBuffer());
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }

    // Local disk mode
    const localFilePath = path.join(process.cwd(), 'storage', 'assets', assetPath);
    if (!fs.existsSync(localFilePath)) {
      return new NextResponse('Asset not found on disk.', { status: 404 });
    }

    const buffer = fs.readFileSync(localFilePath);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error: any) {
    return new NextResponse(error.message || 'Unauthorized', { status: error.status || 401 });
  }
}
