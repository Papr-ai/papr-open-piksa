import { auth } from '@/app/(auth)/auth';
import { checkDatabaseStructure } from '@/lib/db/queries';

export async function GET() {
  try {
    // Only allow admins or in development
    const session = await auth();
    const isAdmin = session?.user?.email === process.env.ADMIN_EMAIL;
    const isDev = process.env.NODE_ENV === 'development';

    if (!isAdmin && !isDev) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await checkDatabaseStructure();

    return Response.json({
      message: 'Database structure check completed',
      result,
    });
  } catch (error) {
    console.error('Error in database check API route:', error);
    return Response.json(
      {
        error: 'Failed to check database structure',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
