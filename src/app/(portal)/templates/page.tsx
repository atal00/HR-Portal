import React from 'react';
import { db } from '@/lib/db';
import { TemplatesView } from '@/components/templates/TemplatesView';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  const templates = await db.templates.list();

  return <TemplatesView templates={templates} />;
}
