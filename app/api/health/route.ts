import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    app: 'Bilik Strategi Workspace',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    mock_mode: process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true',
    clickup_configured: Boolean(process.env.CLICKUP_PERSONAL_TOKEN),
    supabase_configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
  });
}
