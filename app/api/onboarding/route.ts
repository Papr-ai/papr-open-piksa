import { auth } from '@/app/(auth)/auth';
import { user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { NextRequest, NextResponse } from 'next/server';

// Database connection
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, image, referredBy, useCase } = body;

    // Update user with onboarding data
    await db
      .update(user)
      .set({
        name: name || undefined,
        image: image || undefined,
        referredBy: referredBy || undefined,
        useCase: useCase || undefined,
        onboardingCompleted: true,
      })
      .where(eq(user.id, session.user.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Onboarding API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
