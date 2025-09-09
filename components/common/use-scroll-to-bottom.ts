import { useEffect, useRef, type RefObject } from 'react';

/**
 * Hook to provide smart auto-scroll behavior:
 * - Scrolls to bottom on initial load
 * - Scrolls to bottom when user sends a message
 * - Scrolls to bottom during assistant streaming (unless user has scrolled up)
 * - Respects user scroll position when they manually scroll up
 */
export function useScrollToBottom<T extends HTMLElement>(): [
  RefObject<T>,
  RefObject<T>,
  () => void, // Manual scroll to bottom function
] {
  const containerRef = useRef<T>(null);
  const endRef = useRef<T>(null);
  const userHasScrolledUp = useRef(false);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    const container = containerRef.current;
    const end = endRef.current;

    if (container && end) {
      // Handle scroll events to detect when user manually scrolls up
      const handleScroll = () => {
        if (!container) return;
        
        const { scrollTop, scrollHeight, clientHeight } = container;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        userHasScrolledUp.current = !isNearBottom;
      };

      container.addEventListener('scroll', handleScroll);

      // Auto-scroll on initial load
      if (isInitialLoad.current) {
        end.scrollIntoView({ behavior: 'instant', block: 'end' });
        isInitialLoad.current = false;
      }

      // Set up MutationObserver to handle content changes (for streaming responses)
      const observer = new MutationObserver((mutations) => {
        // Only auto-scroll if user hasn't scrolled up manually
        if (userHasScrolledUp.current) return;

        // Check if this is a meaningful content change (not just tooltip/UI changes)
        const isSignificantChange = mutations.some(mutation => {
          // Only consider childList mutations with added nodes
          if (mutation.type !== 'childList' || mutation.addedNodes.length === 0) {
            return false;
          }

          // Check each added node to see if it's significant content
          for (const node of Array.from(mutation.addedNodes)) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              
              // Skip any Radix UI portal content (tooltips, popovers, etc.)
              if (element.hasAttribute('data-radix-portal') ||
                  element.querySelector('[data-radix-portal]') ||
                  element.closest('[data-radix-portal]') ||
                  element.hasAttribute('data-radix-popper-content-wrapper') ||
                  element.querySelector('[data-radix-popper-content-wrapper]') ||
                  element.closest('[data-radix-popper-content-wrapper]')) {
                continue; // Skip this node
              }

              // Skip tooltip-related elements
              if (element.hasAttribute('role') && element.getAttribute('role') === 'tooltip' ||
                  element.querySelector('[role="tooltip"]') ||
                  element.closest('[role="tooltip"]') ||
                  element.classList.contains('tooltip') ||
                  element.querySelector('.tooltip')) {
                continue; // Skip this node
              }

              // Skip any element with tooltip-related IDs or classes
              if ((element.id && (element.id.includes('tooltip') || element.id.includes('radix'))) ||
                  (element.className && typeof element.className === 'string' && 
                   (element.className.includes('tooltip') || element.className.includes('radix'))) ||
                  (element.classList && (element.classList.contains('tooltip') || element.classList.contains('radix')))) {
                continue; // Skip this node
              }

              // If we get here, this is likely a significant content change
              return true;
            } else if (node.nodeType === Node.TEXT_NODE && node.textContent && node.textContent.trim().length > 0) {
              // Text nodes with content are usually significant
              return true;
            }
          }

          return false; // No significant nodes found
        });

        if (isSignificantChange) {
          end.scrollIntoView({ behavior: 'instant', block: 'end' });
        }
      });

      observer.observe(container, {
        childList: true,
        subtree: true,
        attributes: false, // Don't observe attribute changes (reduces tooltip triggers)
      });

      return () => {
        observer.disconnect();
        container.removeEventListener('scroll', handleScroll);
      };
    }
  }, []);

  // Manual scroll to bottom function (resets user scroll state)
  const scrollToBottom = () => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      userHasScrolledUp.current = false;
    }
  };

  return [containerRef, endRef, scrollToBottom];
}
