import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { Papr } from '@papr/memory';

// Initialize the Papr client
const getPaprClient = () => {
  const apiKey = process.env.PAPR_MEMORY_API_KEY;
  if (!apiKey) {
    throw new Error('PAPR_MEMORY_API_KEY is not defined');
  }

  const baseURL = process.env.PAPR_MEMORY_API_URL || 'https://memory.papr.ai';
  const secureBaseURL = baseURL.startsWith('https://') ? baseURL : `https://${baseURL.replace('http://', '')}`;

  return new Papr({
    xAPIKey: apiKey, // Changed from apiKey to xAPIKey based on ClientOptions
    baseURL: secureBaseURL,
  });
};

// Create or retrieve a Papr user
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = process.env.PAPR_MEMORY_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Memory service not configured' }, { status: 500 });
    }
    
    const client = getPaprClient();
    
    // Create the external ID for this user
    const externalId = `PaprChat-user-${session.user.id}`;
    let user;

    try {
      // Try to list users with this external ID
      const listResponse = await client.user.list({ external_id: externalId });
      
      // Check if we have any users in the response
      if (listResponse && listResponse.data && Array.isArray(listResponse.data) && listResponse.data.length > 0) {
        user = listResponse.data[0];
      } else {
        throw new Error('User not found');
      }
    } catch (error) {
      console.log('User not found, will create a new one');
      // User doesn't exist, create a new one
      const createUserParams = {
        external_id: externalId,
        email: session.user.email || '',
        metadata: {
          source: 'PaprChat',
          app_user_id: session.user.id,
          name: session.user.name || '',
        },
      };
      
      user = await client.user.create(createUserParams);
    }

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Error getting/creating Papr user:', error);
    return NextResponse.json(
      { error: 'Failed to get or create Papr user' },
      { status: 500 },
    );
  }
}

// Update a Papr user
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user_id, metadata } = await request.json();
    if (!user_id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    const client = getPaprClient();
    
    // Update the user with proper parameters
    const updateParams = {
      metadata: {
        ...metadata,
        source: 'PaprChat',
        app_user_id: session.user.id,
      },
    };
    
    const user = await client.user.update(user_id, updateParams);

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Error updating Papr user:', error);
    return NextResponse.json(
      { error: 'Failed to update Papr user' },
      { status: 500 },
    );
  }
}

// Delete a Papr user
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get('id');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    const client = getPaprClient();
    
    // Delete the user
    const result = await client.user.delete(userId);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('Error deleting Papr user:', error);
    return NextResponse.json(
      { error: 'Failed to delete Papr user' },
      { status: 500 },
    );
  }
} 