import { z } from 'zod';
import { tool } from 'ai';
import type { Session } from 'next-auth';
import { WORKFLOW_STEPS, getWorkflowProgress, validateWorkflowStep, WORKFLOW_PROMPTS } from './enhanced-book-tools';

// Book Workflow Status and Guidance Tool
const workflowStatusSchema = z.object({
  bookId: z.string().describe('The book ID to check status for'),
  action: z.enum(['status', 'next_step', 'overview']).default('status').describe('What information to retrieve'),
});

export const getBookWorkflowStatus = ({ session }: { session: Session }) =>
  tool({
    description: `Get the current status and progress of a book creation workflow.
    
    This tool helps track progress through the enhanced book creation process:
    - Check which steps are completed
    - Get guidance on the next step
    - View workflow overview and requirements
    - Understand approval gates and requirements`,
    inputSchema: workflowStatusSchema,
    execute: async (input) => {
      const { bookId, action } = input;

      if (!session?.user?.id) {
        return {
          error: 'User session required',
          success: false
        };
      }

      try {
        const { createMemoryService } = await import('@/lib/ai/memory/service');
        const { ensurePaprUser } = await import('@/lib/ai/memory/middleware');
        const apiKey = process.env.PAPR_MEMORY_API_KEY;
        
        if (!apiKey) {
          return {
            error: 'Memory service not available',
            success: false
          };
        }

        const memoryService = createMemoryService(apiKey);
        const paprUserId = await ensurePaprUser(session.user.id, apiKey);
        
        if (!paprUserId) {
          return {
            error: 'Failed to get user ID',
            success: false
          };
        }

        // Search for all book-related memories
        const bookMemories = await memoryService.searchMemories(
          paprUserId,
          `book ${bookId}`,
          50
        );

        // Analyze workflow progress
        const stepStatuses = {
          1: { completed: false, pending: false, step: 'Story Planning' },
          2: { completed: false, pending: false, step: 'Chapter Drafting' },
          3: { completed: false, pending: false, step: 'Scene Segmentation' },
          4: { completed: false, pending: false, step: 'Character Creation' },
          5: { completed: false, pending: false, step: 'Environment Creation' },
          6: { completed: false, pending: false, step: 'Scene Creation' },
          7: { completed: false, pending: false, step: 'Book Completion' }
        };

        let isPictureBook = false;
        let bookTitle = '';
        let completedSteps: number[] = [];

        // Analyze memories to determine progress
        for (const memory of bookMemories) {
          if (memory.metadata?.book_id === bookId) {
            // Determine if it's a picture book
            if (memory.metadata?.is_picture_book === true) {
              isPictureBook = true;
            }
            
            // Get book title
            if (memory.metadata?.book_title && typeof memory.metadata.book_title === 'string') {
              bookTitle = memory.metadata.book_title;
            }

            // Check step completion status
            const step = memory.metadata?.step;
            const status = memory.metadata?.status;
            
            switch (step) {
              case 'planning':
                if (status === 'approved') {
                  stepStatuses[1].completed = true;
                  completedSteps.push(1);
                } else if (status === 'pending_approval') {
                  stepStatuses[1].pending = true;
                }
                break;
              case 'chapter_drafting':
                if (status === 'approved') {
                  stepStatuses[2].completed = true;
                  completedSteps.push(2);
                } else if (status === 'pending_approval') {
                  stepStatuses[2].pending = true;
                }
                break;
              case 'scene_segmentation':
                if (status === 'approved') {
                  stepStatuses[3].completed = true;
                  completedSteps.push(3);
                } else if (status === 'pending_approval') {
                  stepStatuses[3].pending = true;
                }
                break;
              case 'character_creation':
                if (status === 'approved') {
                  stepStatuses[4].completed = true;
                  completedSteps.push(4);
                } else if (status === 'pending_approval') {
                  stepStatuses[4].pending = true;
                }
                break;
              case 'environment_creation':
                if (status === 'approved') {
                  stepStatuses[5].completed = true;
                  completedSteps.push(5);
                } else if (status === 'pending_approval') {
                  stepStatuses[5].pending = true;
                }
                break;
              case 'scene_rendering':
                if (status === 'approved') {
                  stepStatuses[6].completed = true;
                  completedSteps.push(6);
                } else if (status === 'pending_approval') {
                  stepStatuses[6].pending = true;
                }
                break;
              case 'book_completion':
                if (status === 'ready_for_publishing') {
                  stepStatuses[7].completed = true;
                  completedSteps.push(7);
                } else if (status === 'pending_final_review') {
                  stepStatuses[7].pending = true;
                }
                break;
            }
          }
        }

        const progress = getWorkflowProgress(completedSteps, isPictureBook);
        
        switch (action) {
          case 'status':
            return {
              success: true,
              bookId,
              bookTitle,
              isPictureBook,
              progress: {
                completedSteps: progress.completedSteps,
                totalSteps: progress.totalSteps,
                percentage: progress.percentage,
                nextStep: progress.nextStep
              },
              stepStatuses: Object.entries(stepStatuses)
                .filter(([step]) => validateWorkflowStep(Number(step), isPictureBook))
                .reduce((acc, [step, status]) => {
                  acc[step] = status;
                  return acc;
                }, {} as Record<string, any>),
              pendingApprovals: Object.entries(stepStatuses)
                .filter(([step, status]) => 
                  validateWorkflowStep(Number(step), isPictureBook) && status.pending
                )
                .map(([step]) => `Step ${step}: ${stepStatuses[Number(step) as keyof typeof stepStatuses].step}`)
            };

          case 'next_step':
            const nextStep = progress.nextStep;
            if (!nextStep) {
              return {
                success: true,
                bookId,
                message: 'Book workflow is complete!',
                isComplete: true
              };
            }
            
            return {
              success: true,
              bookId,
              nextStep,
              nextStepName: WORKFLOW_STEPS[nextStep as keyof typeof WORKFLOW_STEPS]?.name,
              nextStepDescription: WORKFLOW_STEPS[nextStep as keyof typeof WORKFLOW_STEPS]?.description,
              approvalGate: WORKFLOW_STEPS[nextStep as keyof typeof WORKFLOW_STEPS]?.approvalGate,
              guidance: WORKFLOW_PROMPTS.stepGuidance(nextStep, isPictureBook)
            };

          case 'overview':
            return {
              success: true,
              bookId,
              bookTitle,
              isPictureBook,
              workflowOverview: WORKFLOW_PROMPTS.workflowOverview(isPictureBook),
              applicableSteps: Object.entries(WORKFLOW_STEPS)
                .filter(([step]) => validateWorkflowStep(Number(step), isPictureBook))
                .map(([step, info]) => ({
                  step: Number(step),
                  name: info.name,
                  description: info.description,
                  approvalGate: info.approvalGate,
                  completed: stepStatuses[Number(step) as keyof typeof stepStatuses]?.completed || false,
                  pending: stepStatuses[Number(step) as keyof typeof stepStatuses]?.pending || false
                }))
            };

          default:
            return {
              error: 'Invalid action',
              success: false
            };
        }

      } catch (error) {
        console.error('[getBookWorkflowStatus] Error:', error);
        return {
          error: 'Failed to retrieve workflow status',
          success: false,
          details: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    },
  });

export type WorkflowStatusInput = z.infer<typeof workflowStatusSchema>;

