'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ExternalLink, Info, Mic, Server } from 'lucide-react';

export function VoiceSetupNotice() {
  return (
    <Card className="max-w-2xl mx-auto my-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5" />
          Voice Chat Setup Required
        </CardTitle>
        <CardDescription>
          OpenAI&apos;s Realtime API requires additional setup for browser-based applications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Browser WebSocket connections cannot send the <code>Authorization: Bearer</code> headers 
            required by OpenAI&apos;s Realtime API. This is a browser security limitation.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <Server className="h-4 w-4" />
            Solution Options:
          </h4>
          
          <div className="grid gap-3">
            <div className="p-3 border rounded-lg">
              <h5 className="font-medium">Option 1: WebSocket Proxy Server</h5>
              <p className="text-sm text-muted-foreground mt-1">
                Create a dedicated WebSocket server (Node.js/Python) that proxies connections 
                to OpenAI&apos;s API with proper authentication headers.
              </p>
            </div>
            
            <div className="p-3 border rounded-lg">
              <h5 className="font-medium">Option 2: Server-Side Voice Processing</h5>
              <p className="text-sm text-muted-foreground mt-1">
                Use OpenAI&apos;s standard API with separate speech-to-text and text-to-speech endpoints,
                processing audio on your server.
              </p>
            </div>
            
            <div className="p-3 border rounded-lg">
              <h5 className="font-medium">Option 3: Third-Party Voice Solutions</h5>
              <p className="text-sm text-muted-foreground mt-1">
                Integrate with voice platforms like ElevenLabs, Azure Speech, or Google Speech 
                that offer browser-compatible APIs.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <Button variant="outline" size="sm" asChild>
            <a 
              href="https://platform.openai.com/docs/guides/realtime" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              OpenAI Realtime Docs
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a 
              href="https://github.com/openai/openai-realtime-examples" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              Example Implementations
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
