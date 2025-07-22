import { useEffect, useRef, type RefObject } from 'react';

/**
 * Hook to scroll to the bottom of a container
 */
export function useScrollToBottom<T extends HTMLElement>(): [
  RefObject<T>,
  RefObject<T>,
] {
  const containerRef = useRef<T>(null);
  const endRef = useRef<T>(null);
  const userScrolledUp = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    const end = endRef.current;

    if (container && end) {
      // Handle scroll events to detect when user manually scrolls up
      const handleScroll = () => {
        if (!container) return;
        
        // Check if user has scrolled up
        const isAtBottom = isNearBottom(container);
        userScrolledUp.current = !isAtBottom;
      };

      // Function to check if container is scrolled to near bottom
      const isNearBottom = (element: HTMLElement) => {
        const { scrollTop, scrollHeight, clientHeight } = element;
        // Consider "near bottom" if within 100px of the bottom
        return scrollHeight - scrollTop - clientHeight < 100;
      };

      container.addEventListener('scroll', handleScroll);

      const observer = new MutationObserver(() => {
        // Only auto-scroll if user hasn't scrolled up manually
        if (!userScrolledUp.current) {
          end.scrollIntoView({ behavior: 'instant', block: 'end' });
        }
      });

      observer.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });

      return () => {
        observer.disconnect();
        container.removeEventListener('scroll', handleScroll);
      };
    }
  }, []);

  return [containerRef, endRef];
}
