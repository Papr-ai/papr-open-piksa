import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: bookId } = await params;
    
    // Import workflow state retrieval function
    const { getWorkflowFromDatabase } = await import('@/lib/ai/tools/unified-book-creation');
    
    // Get workflow state from database
    const workflowState = await getWorkflowFromDatabase(bookId, session);
    
    if (!workflowState) {
      // Fallback to task-based progress if no workflow state exists
      const { getBookProgress } = await import('@/lib/db/book-queries');
      const taskProgress = await getBookProgress(bookId, session.user.id);
      
      return NextResponse.json({
        hasWorkflow: false,
        taskBased: true,
        ...taskProgress,
        bookTitle: null,
        currentStepName: null,
        steps: []
      });
    }
    
    // Calculate progress based on workflow steps
    const totalSteps = workflowState.steps.length;
    const completedSteps = workflowState.steps.filter(step => 
      step.status === 'completed' || step.status === 'approved'
    ).length;
    const approvedSteps = workflowState.steps.filter(step => 
      step.status === 'approved'
    ).length;
    
    // Find current step (first pending or in-progress step)
    const currentStep = workflowState.steps.find(step => 
      step.status === 'pending' || step.status === 'in_progress'
    );
    
    const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
    
    return NextResponse.json({
      hasWorkflow: true,
      taskBased: false,
      bookId: workflowState.bookId,
      bookTitle: workflowState.bookTitle,
      bookConcept: workflowState.bookConcept,
      targetAge: workflowState.targetAge,
      currentStep: currentStep?.stepNumber || null,
      currentStepName: currentStep?.stepName || null,
      totalSteps,
      completedSteps,
      approvedSteps,
      progressPercentage,
      steps: workflowState.steps.map(step => ({
        stepNumber: step.stepNumber,
        stepName: step.stepName,
        status: step.status,
        hasData: !!step.data
      })),
      createdAt: workflowState.createdAt,
      updatedAt: workflowState.updatedAt,
      workflowState: workflowState // Add full workflow state for artifact opening
    });
  } catch (error) {
    console.error('Error fetching workflow progress:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
