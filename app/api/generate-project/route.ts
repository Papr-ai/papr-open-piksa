import { auth } from '@/app/(auth)/auth';
import { NextRequest, NextResponse } from 'next/server';
import { myProvider } from '@/lib/ai/providers';
import { multiFileProjectPrompt } from '@/lib/ai/prompts';
import { generateText } from 'ai';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { projectDescription } = await request.json();

    if (!projectDescription) {
      return NextResponse.json(
        { error: 'Missing project description' },
        { status: 400 }
      );
    }

    // Create a special prompt with the project description and instructions
    const prompt = `
I want to create a multi-file project with the following description:
${projectDescription}

Please create all the necessary files for this project following best practices.
`;

    // Call the AI model using generateText
    const { text: completion } = await generateText({
      model: myProvider.languageModel('chat'),
      system: multiFileProjectPrompt,
      prompt: prompt,
    });

    return NextResponse.json({ 
      completion,
      success: true
    });
  } catch (error) {
    console.error('Error in generate project:', error);
    return NextResponse.json(
      { error: 'Failed to generate project' },
      { status: 500 }
    );
  }
} 