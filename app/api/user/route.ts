import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Return limited user data for security
    return NextResponse.json({
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    });
  } catch (error) {
    console.error('Error getting user data:', error);
    return NextResponse.json(
      { error: 'Failed to get user data' },
      { status: 500 },
    );
  }
}
