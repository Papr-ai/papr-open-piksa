'use client';

/**
 * WebSocket client for real-time updates
 * Connects directly to Fly.io WebSocket server, bypassing Vercel for real-time updates
 * Architecture: Neon DB → Fly.io (LISTEN + WebSocket Server) → Frontend Client
 */

export interface RealtimeUpdate {
  table: 'subscription' | 'usage';
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  data: any;
  timestamp: string;
}

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

export type RealtimeCallback = (update: RealtimeUpdate) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private subscribers = new Set<RealtimeCallback>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private isConnecting = false;
  private userId: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private tokenRefreshInterval: NodeJS.Timeout | null = null;
  
  // BroadcastChannel for tab sharing - only one tab maintains the actual WebSocket connection
  private broadcastChannel: BroadcastChannel | null = null;
  private isLeaderTab = false;
  private leaderCheckInterval: NodeJS.Timeout | null = null;

  /**
   * Connect to Fly.io WebSocket server for a specific user
   */
  connect(userId: string, wsUrl?: string): void {
    if (this.ws?.readyState === WebSocket.OPEN && this.userId === userId) {
      console.log('[WebSocket Client] Already connected for user:', userId);
      return;
    }

    if (this.isConnecting) {
      console.log('[WebSocket Client] Connection already in progress');
      return;
    }

    this.userId = userId;
    
    // Initialize BroadcastChannel for tab coordination
    this.initializeBroadcastChannel(userId);
    
    // Check if we should be the leader tab
    this.electLeader();
  }

  /**
   * Initialize BroadcastChannel for cross-tab communication
   */
  private initializeBroadcastChannel(userId: string): void {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
      // Server-side or browser doesn't support BroadcastChannel
      this.connectDirectly();
      return;
    }

    const channelName = `papr-websocket-${userId}`;
    
    try {
      this.broadcastChannel = new BroadcastChannel(channelName);
      
      this.broadcastChannel.onmessage = (event) => {
        const { type, data } = event.data;
        
        switch (type) {
          case 'leader_ping':
            // Another tab is announcing it's the leader
            if (this.isLeaderTab && data.timestamp > Date.now() - 5000) {
              console.log('[WebSocket Client] Another tab became leader, stepping down');
              this.stepDownAsLeader();
            }
            break;
            
          case 'leader_request':
            // Another tab is requesting leadership
            if (this.isLeaderTab) {
              this.broadcastChannel?.postMessage({ 
                type: 'leader_response', 
                data: { timestamp: Date.now() } 
              });
            }
            break;
            
          case 'realtime_update':
            // Forward realtime updates from leader tab to subscribers
            if (!this.isLeaderTab) {
              this.notifySubscribers(data);
            }
            break;
            
          case 'connection_status':
            // Update connection status from leader tab
            if (!this.isLeaderTab) {
              // You could update UI indicators here if needed
            }
            break;
        }
      };
      
      console.log(`[WebSocket Client] BroadcastChannel initialized for user ${userId}`);
    } catch (error) {
      console.error('[WebSocket Client] Failed to initialize BroadcastChannel:', error);
      // Fallback to direct connection
      this.connectDirectly();
    }
  }

  /**
   * Elect this tab as leader if no other leader exists
   */
  private electLeader(): void {
    if (!this.broadcastChannel) {
      this.connectDirectly();
      return;
    }

    // Request leadership
    this.broadcastChannel.postMessage({ 
      type: 'leader_request', 
      data: { timestamp: Date.now() } 
    });

    // Wait for responses, then decide if we should be leader
    setTimeout(() => {
      if (!this.isLeaderTab) {
        console.log('[WebSocket Client] No existing leader found, becoming leader');
        this.becomeLeader();
      }
    }, 100);
  }

  /**
   * Become the leader tab (maintains the actual WebSocket connection)
   */
  private becomeLeader(): void {
    this.isLeaderTab = true;
    console.log('[WebSocket Client] Became leader tab');
    
    // Connect to WebSocket
    this.connectDirectly();
    
    // Start broadcasting leader pings
    this.startLeaderPings();
  }

  /**
   * Step down as leader tab
   */
  private stepDownAsLeader(): void {
    if (!this.isLeaderTab) return;
    
    this.isLeaderTab = false;
    console.log('[WebSocket Client] Stepped down as leader tab');
    
    // Close WebSocket connection
    this.disconnectWebSocket();
    
    // Stop leader pings
    this.stopLeaderPings();
  }

  /**
   * Connect directly to WebSocket (used by leader tab or when BroadcastChannel unavailable)
   */
  private connectDirectly(): void {
    if (this.isConnecting) {
      console.log('[WebSocket Client] Connection already in progress');
      return;
    }

    this.isConnecting = true;
    const url = this.getWebSocketUrl();
    
    try {
      // Close existing connection
      this.disconnectWebSocket();

      console.log('[WebSocket Client] Connecting to Fly.io WebSocket server:', url);
      
      // Create actual WebSocket connection to Fly.io
      this.createWebSocket(url);
      
    } catch (error) {
      console.error('[WebSocket Client] Failed to create WebSocket:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }


  /**
   * Create WebSocket connection to Fly.io server
   */
  private createWebSocket(url: string): void {
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[WebSocket Client] Connected to WebSocket server');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.isConnecting = false;
      
      if (this.userId) {
        this.notifyConnection(this.userId);
      }
      
      this.startHeartbeat();
      this.startTokenRefresh();
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        console.log('[WebSocket Client] Received message:', message);
        
        // Handle different message types from Fly.io server
        if (message.type === 'realtime_update') {
          const update: RealtimeUpdate = message.data;
          
          // If we're the leader tab, broadcast to other tabs via BroadcastChannel
          if (this.isLeaderTab && this.broadcastChannel) {
            this.broadcastChannel.postMessage({
              type: 'realtime_update',
              data: update
            });
          }
          
          // Notify local subscribers
          this.notifySubscribers(update);
        } else if (message.type === 'auth_required') {
          // Send authentication to Fly.io server
          this.sendAuth();
        }
      } catch (error) {
        console.error('[WebSocket Client] Error parsing message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('[WebSocket Client] WebSocket error:', error);
      this.isConnecting = false;
    };

    this.ws.onclose = (event) => {
      console.log('[WebSocket Client] WebSocket closed:', event.code, event.reason);
      this.isConnecting = false;
      this.stopHeartbeat();
      this.stopTokenRefresh();
      
      if (event.code !== 1000) { // Not a normal closure
        this.scheduleReconnect();
      }
    };
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.disconnectWebSocket();
    this.cleanupBroadcastChannel();
    this.isConnecting = false;
    this.userId = null;
  }

  /**
   * Disconnect only the WebSocket (used internally)
   */
  private disconnectWebSocket(): void {
    if (this.ws) {
      console.log('[WebSocket Client] Disconnecting from WebSocket');
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.stopHeartbeat();
    this.stopTokenRefresh();
    this.stopLeaderPings();
  }

  /**
   * Clean up BroadcastChannel resources
   */
  private cleanupBroadcastChannel(): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
    this.isLeaderTab = false;
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
    if (typeof window === 'undefined') return false; // Server-side
    
    // If we're the leader tab, check our WebSocket
    if (this.isLeaderTab) {
      return this.ws?.readyState === WebSocket.OPEN;
    }
    
    // If we're not the leader but have a BroadcastChannel, we're "connected" through the leader
    return this.broadcastChannel !== null;
  }

  /**
   * Get number of active subscribers
   */
  get subscriberCount(): number {
    return this.subscribers.size;
  }

  /**
   * Get current user ID
   */
  get currentUserId(): string | null {
    return this.userId;
  }

  private getWebSocketUrl(): string {
    if (typeof window === 'undefined') return '';
    
    // Connect to your Fly.io WebSocket server
    // Use environment variable or default to your Fly.io app URL
    const flyioUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'wss://papr-realtime.fly.dev';
    
    return `${flyioUrl}/ws?userId=${encodeURIComponent(this.userId || '')}`;
  }

  /**
   * Send authentication token to Fly.io server
   */
  private async sendAuth(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    try {
      // Get auth token from Vercel (short-lived)
      const response = await fetch('/api/auth/websocket-token');
      const { token } = await response.json();
      
      this.ws.send(JSON.stringify({
        type: 'auth',
        token,
        userId: this.userId,
      }));
    } catch (error) {
      console.error('[WebSocket Client] Error sending auth:', error);
    }
  }

  private notifyConnection(userId: string): void {
    console.log('[WebSocket Client] Connected for user:', userId);
    
    // Send synthetic connection event
    this.subscribers.forEach(callback => {
      try {
        callback({
          table: 'subscription',
          operation: 'UPDATE',
          data: { connected: true, userId },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('[WebSocket Client] Error in connection callback:', error);
      }
    });
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
      }
    }, 30000); // 30 second heartbeat
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private startTokenRefresh(): void {
    // Refresh token every 25 minutes (5 minutes before 30-minute expiry)
    this.tokenRefreshInterval = setInterval(async () => {
      console.log('[WebSocket Client] Refreshing authentication token');
      await this.sendAuth();
    }, 25 * 60 * 1000); // 25 minutes
  }

  private stopTokenRefresh(): void {
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
      this.tokenRefreshInterval = null;
    }
  }

  /**
   * Start broadcasting leader pings to other tabs
   */
  private startLeaderPings(): void {
    this.leaderCheckInterval = setInterval(() => {
      if (this.isLeaderTab && this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          type: 'leader_ping',
          data: { timestamp: Date.now() }
        });
      }
    }, 5000); // Ping every 5 seconds
  }

  /**
   * Stop broadcasting leader pings
   */
  private stopLeaderPings(): void {
    if (this.leaderCheckInterval) {
      clearInterval(this.leaderCheckInterval);
      this.leaderCheckInterval = null;
    }
  }

  /**
   * Notify all local subscribers of an update
   */
  private notifySubscribers(update: RealtimeUpdate): void {
    this.subscribers.forEach(callback => {
      try {
        callback(update);
      } catch (error) {
        console.error('[WebSocket Client] Error in subscriber callback:', error);
      }
    });
  }

  private scheduleReconnect(): void {
    // Only leader tabs should reconnect the WebSocket
    if (!this.isLeaderTab) {
      console.log('[WebSocket Client] Non-leader tab, skipping reconnect');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket Client] Max reconnect attempts reached, giving up');
      return;
    }

    if (!this.userId) {
      console.log('[WebSocket Client] No userId, skipping reconnect');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    console.log(`[WebSocket Client] Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (this.userId && !this.isConnected && !this.isConnecting && this.isLeaderTab) {
        console.log('[WebSocket Client] Attempting reconnect...');
        this.connectDirectly();
      }
    }, delay);
  }
}

// Global singleton instance
export const webSocketClient = new WebSocketClient();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    webSocketClient.disconnect();
  });
}

/**
 * React hook for using WebSocket real-time updates
 * Drop-in replacement for the old useRealtimeUpdates hook
 */
import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

export function useWebSocketUpdates(callback: RealtimeCallback) {
  const { data: session, status } = useSession();
  const callbackRef = useRef(callback);
  
  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    // Don't connect if session is still loading
    if (status === 'loading') {
      return;
    }

    // Don't connect if user is not authenticated
    if (!session?.user?.id) {
      console.log('[WebSocket Client] No authenticated user, skipping WebSocket connection');
      webSocketClient.disconnect();
      return;
    }

    console.log('[WebSocket Client] Authenticated user detected, connecting WebSocket');
    
    // Connect to WebSocket updates
    webSocketClient.connect(session.user.id);

    // Subscribe to updates with stable callback
    const unsubscribe = webSocketClient.subscribe((update) => {
      callbackRef.current(update);
    });

    return () => {
      unsubscribe();
      // Don't disconnect here - other components might be using it
    };
  }, [session?.user?.id, status]);

  return {
    isConnected: webSocketClient.isConnected,
    subscriberCount: webSocketClient.subscriberCount,
  };
}

/**
 * Utility to manually trigger reconnection
 */
export function reconnectWebSocket(): void {
  if (webSocketClient.currentUserId) {
    webSocketClient.disconnect();
    setTimeout(() => {
      if (webSocketClient.currentUserId) {
        webSocketClient.connect(webSocketClient.currentUserId);
      }
    }, 100);
  }
}
