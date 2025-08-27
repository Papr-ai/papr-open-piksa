import { NextRequest } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { searchMemories } from '@/lib/ai/tools/search-memories';
import { addMemory } from '@/lib/ai/tools/add-memory';

// Handle function calls from OpenAI Realtime API WebRTC
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED'
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { functionName, arguments: functionArgs } = await request.json();
    
    console.log('[Voice Tools] Function call received:', {
      functionName,
      arguments: functionArgs,
      userId: session.user.id
    });

    let result: any;
    
    try {
      switch (functionName) {
        case 'searchMemories': {
          console.log('[Voice Tools] 🔍 SEARCH MEMORIES TRIGGERED');
          console.log('='.repeat(60));
          console.log('[Voice Tools] User ID:', session.user.id);
          console.log('[Voice Tools] Search Query:', functionArgs.query);
          console.log('[Voice Tools] Timestamp:', new Date().toISOString());
          console.log('='.repeat(60));
          
          const startTime = Date.now();
          const searchTool = searchMemories({ session });
          
          if (!searchTool.execute) {
            throw new Error('Search tool execute function is not available');
          }
          
          result = await searchTool.execute(functionArgs, {
            toolCallId: 'voice-search-' + Date.now(),
            messages: []
          });
          const duration = Date.now() - startTime;
          
          console.log('[Voice Tools] 🔍 SEARCH MEMORIES COMPLETED');
          console.log('='.repeat(60));
          console.log('[Voice Tools] Duration:', duration + 'ms');
          console.log('[Voice Tools] Success:', !result.error);
          console.log('[Voice Tools] Results Found:', result.memories?.length || 0);
          if (result.memories?.length > 0) {
            console.log('[Voice Tools] Memory Previews:');
            result.memories.slice(0, 3).forEach((mem: any, i: number) => {
              console.log(`  ${i + 1}. ${mem.content?.substring(0, 100)}...`);
            });
          }
          if (result.error) {
            console.log('[Voice Tools] Error:', result.error);
          }
          console.log('='.repeat(60));
          break;
        }
        
        case 'addMemory': {
          console.log('[Voice Tools] 💾 ADD MEMORY TRIGGERED');
          console.log('='.repeat(60));
          console.log('[Voice Tools] User ID:', session.user.id);
          console.log('[Voice Tools] Content:', functionArgs.content);
          console.log('[Voice Tools] Category:', functionArgs.category);
          console.log('[Voice Tools] Type:', functionArgs.type || 'text');
          console.log('[Voice Tools] Timestamp:', new Date().toISOString());
          console.log('='.repeat(60));
          
          const startTime = Date.now();
          const addTool = addMemory({ session });
          
          if (!addTool.execute) {
            throw new Error('Add memory tool execute function is not available');
          }
          
          result = await addTool.execute(functionArgs, {
            toolCallId: 'voice-add-' + Date.now(),
            messages: []
          });
          const duration = Date.now() - startTime;
          
          console.log('[Voice Tools] 💾 ADD MEMORY COMPLETED');
          console.log('='.repeat(60));
          console.log('[Voice Tools] Duration:', duration + 'ms');
          console.log('[Voice Tools] Success:', !result.error);
          if (result.success) {
            console.log('[Voice Tools] Memory ID:', result.memoryId || 'N/A');
            console.log('[Voice Tools] Added to category:', functionArgs.category);
          }
          if (result.error) {
            console.log('[Voice Tools] Error:', result.error);
          }
          console.log('='.repeat(60));
          break;
        }
        
        default:
          throw new Error(`Unknown function: ${functionName}`);
      }
      
      console.log('[Voice Tools] Function execution result:', {
        functionName,
        success: !result.error,
        resultType: typeof result
      });
      
      return new Response(JSON.stringify({
        success: true,
        result
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (toolError) {
      console.error('[Voice Tools] Tool execution error:', toolError);
      return new Response(JSON.stringify({
        success: false,
        error: toolError instanceof Error ? toolError.message : 'Tool execution failed',
        result: {
          error: 'Tool execution failed',
          errorDetails: toolError instanceof Error ? toolError.message : String(toolError)
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('[Voice Tools] API Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
