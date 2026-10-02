import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/rbac';

export async function GET() {
  try {
    const sessionUser = await requireAuthUser();
    const metadata = await db.corporateMetadata.get();
    return NextResponse.json({ success: true, metadata });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const sessionUser = await requireAuthUser();

    // Only SUPER_ADMIN or user with settings.update permission
    const canEdit = sessionUser.role === 'SUPER_ADMIN' || hasPermission(sessionUser, 'settings.update');
    if (!canEdit) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient privileges to update corporate legal metadata.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      brand_name,
      legal_entity,
      corporate_website,
      corporate_email,
      registered_office_address,
      cin,
    } = body;

    // Field validations
    if (!brand_name?.trim()) {
      return NextResponse.json({ error: 'Brand Name is required.' }, { status: 400 });
    }
    if (!legal_entity?.trim()) {
      return NextResponse.json({ error: 'Legal Entity is required.' }, { status: 400 });
    }
    if (!corporate_website?.trim() || !corporate_website.startsWith('http')) {
      return NextResponse.json({ error: 'Valid Corporate Website URL is required.' }, { status: 400 });
    }
    if (!corporate_email?.trim() || !corporate_email.includes('@')) {
      return NextResponse.json({ error: 'Valid Corporate Email address is required.' }, { status: 400 });
    }
    if (!registered_office_address?.trim()) {
      return NextResponse.json({ error: 'Registered Office Address is required.' }, { status: 400 });
    }

    const updated = await db.corporateMetadata.update(
      {
        brand_name: brand_name.trim(),
        legal_entity: legal_entity.trim(),
        corporate_website: corporate_website.trim(),
        corporate_email: corporate_email.trim(),
        registered_office_address: registered_office_address.trim(),
        cin: cin?.trim() || '',
      },
      sessionUser.id
    );

    return NextResponse.json({ success: true, metadata: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}
