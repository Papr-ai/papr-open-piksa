'use client';

/**
 * Real-time client for receiving database updates via Server-Sent Events
 * This replaces polling with instant updates when subscription/usage data changes
 */

export interface RealtimeUpdate {
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  data: any;
  timestamp: number;
}

export type RealtimeCallback = (update: RealtimeUpdate) => void;

class RealtimeClient {
  private eventSource: EventSource | null = null;
  private subscribers = new Set<RealtimeCallback>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private isConnecting = false;
  public userId: string | null = null;

  /**
   * Connect to real-time updates for a specific user
   */
  connect(userId: string): void {
    if (this.eventSource?.readyState === EventSource.OPEN && this.userId === userId) {
      console.log('[Realtime Client] Already connected for user:', userId);
      return;
    }

    if (this.isConnecting) {
      console.log('[Realtime Client] Connection already in progress');
      return;
    }

    this.userId = userId;
    this.isConnecting = true;

    try {
      // Close existing connection
      this.disconnect();

      console.log('[Realtime Client] Connecting to real-time updates for user:', userId);
      
      this.eventSource = new EventSource(`/api/realtime/subscribe?userId=${encodeURIComponent(userId)}`);
      
      this.eventSource.onopen = () => {
        console.log('[Realtime Client] Connected to real-time updates');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.isConnecting = false;
      };

      this.eventSource.onmessage = (event) => {
        try {
          const update: RealtimeUpdate = JSON.parse(event.data);
          console.log('[Realtime Client] Received update:', update);
          
          // Notify all subscribers
          this.subscribers.forEach(callback => {
            try {
              callback(update);
            } catch (error) {
              console.error('[Realtime Client] Error in subscriber callback:', error);
            }
          });
        } catch (error) {
          console.error('[Realtime Client] Error parsing update:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('[Realtime Client] Connection error:', error);
        this.isConnecting = false;
        
        if (this.eventSource?.readyState === EventSource.CLOSED) {
          this.scheduleReconnect();
        }
      };

    } catch (error) {
      console.error('[Realtime Client] Failed to create EventSource:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from real-time updates
   */
  disconnect(): void {
    if (this.eventSource) {
      console.log('[Realtime Client] Disconnecting from real-time updates');
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnecting = false;
    this.userId = null;
  }

  /**
   * Subscribe to real-time updates
   */
  subscribe(callback: RealtimeCallback): () => void {
    this.subscribers.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Get connection status
   */
  get isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }

  /**
   * Get number of active subscribers
   */
  get subscriberCount(): number {
    return this.subscribers.size;
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Realtime Client] Max reconnect attempts reached, giving up');
      return;
    }

    if (!this.userId) {
      console.log('[Realtime Client] No userId, skipping reconnect');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    console.log(`[Realtime Client] Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (this.userId && !this.isConnected && !this.isConnecting) {
        console.log('[Realtime Client] Attempting reconnect...');
        this.connect(this.userId);
      }
    }, delay);
  }
}

// Global singleton instance
export const realtimeClient = new RealtimeClient();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    realtimeClient.disconnect();
  });
}

/**
 * React hook for using real-time updates
 */
import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

export function useRealtimeUpdates(callback: RealtimeCallback) {
  const { data: session } = useSession();
  const callbackRef = useRef(callback);
  
  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!session?.user?.id) {
      realtimeClient.disconnect();
      return;
    }

    // Connect to real-time updates
    realtimeClient.connect(session.user.id);

    // Subscribe to updates with stable callback
    const unsubscribe = realtimeClient.subscribe((update) => {
      callbackRef.current(update);
    });

    return () => {
      unsubscribe();
      // Don't disconnect here - other components might be using it
    };
  }, [session?.user?.id]);

  return {
    isConnected: realtimeClient.isConnected,
    subscriberCount: realtimeClient.subscriberCount,
  };
}

/**
 * Utility to manually trigger reconnection
 */
export function reconnectRealtime(): void {
  if (realtimeClient.userId) {
    realtimeClient.disconnect();
    setTimeout(() => {
      if (realtimeClient.userId) {
        realtimeClient.connect(realtimeClient.userId);
      }
    }, 100);
  }
}
