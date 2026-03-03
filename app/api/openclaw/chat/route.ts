// Redirecionamento para /api/openclaw/autonomous
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Redirecionar para endpoint principal
  const body = await request.json();
  
  const response = await fetch(new URL('/api/openclaw/autonomous', request.url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  const data = await response.json();
  return NextResponse.json(data);
}

export async function GET(request: NextRequest) {
  const response = await fetch(new URL('/api/openclaw/autonomous', request.url));
  const data = await response.json();
  return NextResponse.json(data);
}
