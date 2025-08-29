import { memo } from 'react';
import { CrossIcon } from '@/components/common/icons';
import { Button } from '@/components/ui/button';
import { initialArtifactData, useArtifact } from '@/hooks/use-artifact';

interface ArtifactCloseButtonProps {
  chatId?: string;
}

function PureArtifactCloseButton({ chatId }: ArtifactCloseButtonProps) {
  const { setArtifact } = useArtifact(chatId);

  return (
    <Button
      data-testid="artifact-close-button"
      variant="outline"
      className="h-fit p-2 dark:hover:bg-zinc-700"
      onClick={() => {
        console.log('[ARTIFACT CLOSE] 🔴 STARTING ARTIFACT CLOSE PROCESS');
        console.log('[ARTIFACT CLOSE] Chat ID:', chatId);
        console.log('[ARTIFACT CLOSE] Timestamp:', new Date().toISOString());
        
        // Log current page state
        console.log('[ARTIFACT CLOSE] Current page state:', {
          url: window.location.href,
          readyState: document.readyState,
          activeElement: document.activeElement?.tagName,
          scrollY: window.scrollY
        });
        
        // Force cleanup of any pending operations
        try {
          console.log('[ARTIFACT CLOSE] 🔄 Setting artifact state...');
          setArtifact(() => {
            console.log('[ARTIFACT CLOSE] 🔄 Hard-resetting artifact to initial state');
            const resetState = { 
              ...initialArtifactData, 
              status: 'idle' as const,
              documentId: 'init',
              isVisible: false,
            };
            console.log('[ARTIFACT CLOSE] New state:', resetState);
            return resetState;
          });
          
          console.log('[ARTIFACT CLOSE] ✅ Artifact state updated successfully');
          
          // Force a small delay to ensure state is processed
          setTimeout(() => {
            console.log('[ARTIFACT CLOSE] 🕐 Post-close check - page should be responsive now');
            
            // Test page responsiveness
            const testResponsiveness = () => {
              console.log('[ARTIFACT CLOSE] 🧪 Testing page responsiveness...');
              
              // Test if we can still interact with DOM
              try {
                const testElement = document.createElement('div');
                testElement.style.display = 'none';
                document.body.appendChild(testElement);
                document.body.removeChild(testElement);
                console.log('[ARTIFACT CLOSE] ✅ DOM manipulation test passed');
              } catch (domError) {
                console.error('[ARTIFACT CLOSE] ❌ DOM manipulation test failed:', domError);
              }
              
              // Test if we can still log (indicates JS is running)
              console.log('[ARTIFACT CLOSE] ✅ JavaScript execution test passed');
              
              // Add a temporary click listener to test event handling
              const clickTest = () => {
                console.log('[ARTIFACT CLOSE] ✅ Click event handling test passed - page is responsive!');
                document.removeEventListener('click', clickTest);
              };
              document.addEventListener('click', clickTest);
              
              setTimeout(() => {
                document.removeEventListener('click', clickTest);
                console.log('[ARTIFACT CLOSE] ⏰ Click test timeout (this is normal if no clicks happened)');
              }, 2000);
            };
            
            testResponsiveness();
          }, 100);
          
        } catch (error) {
          console.error('[ARTIFACT CLOSE] ❌ Error during artifact close:', error);
          console.error('[ARTIFACT CLOSE] Error stack:', error instanceof Error ? error.stack : 'No stack');
          
          try {
            console.log('[ARTIFACT CLOSE] 🚨 Attempting force reset...');
            setArtifact(initialArtifactData);
            console.log('[ARTIFACT CLOSE] ✅ Force reset completed');
          } catch (forceError) {
            console.error('[ARTIFACT CLOSE] 💥 CRITICAL: Force reset also failed:', forceError);
          }
        }
        
        console.log('[ARTIFACT CLOSE] 🏁 ARTIFACT CLOSE PROCESS COMPLETED');
      }}
    >
      <CrossIcon size={18} />
    </Button>
  );
}

export const ArtifactCloseButton = memo(PureArtifactCloseButton, (prevProps, nextProps) => 
  prevProps.chatId === nextProps.chatId
);
