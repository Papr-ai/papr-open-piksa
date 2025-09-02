'use client';

import React, { useState, useRef, useEffect } from 'react';
import { PlayIcon, VideoIcon, LoaderIcon } from '@/components/common/icons';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useBookContext } from './book-context';

interface ImageVideoOverlayProps {
  imageSrc: string;
  imageAlt?: string;
  isFullPage?: boolean;
  initialVideoUrl?: string;
  storyContext?: string; // Add direct prop for story context
  onVideoGenerated?: (videoUrl: string) => void;
}

type VideoState = 'image' | 'generating' | 'video' | 'playing';

export function ImageVideoOverlay({
  imageSrc,
  imageAlt = '',
  isFullPage = false,
  initialVideoUrl,
  storyContext: propStoryContext, // Rename to avoid confusion
  onVideoGenerated
}: ImageVideoOverlayProps) {
  const [videoState, setVideoState] = useState<VideoState>(
    initialVideoUrl ? 'video' : 'image'
  );
  const [videoUrl, setVideoUrl] = useState<string | null>(initialVideoUrl || null);
  const [isHovered, setIsHovered] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { storyContext: contextStoryContext, bookId, bookTitle } = useBookContext();
  
  // Use prop story context if available, otherwise fall back to context
  const storyContext = propStoryContext || contextStoryContext;

  // Update state when initialVideoUrl prop changes (for page navigation)
  useEffect(() => {
    if (initialVideoUrl !== videoUrl) {
      console.log('[ImageVideoOverlay] Video URL changed:', {
        from: videoUrl,
        to: initialVideoUrl,
        imageSrc: imageSrc.substring(0, 50) + '...'
      });
      setVideoUrl(initialVideoUrl || null);
      setVideoState(initialVideoUrl ? 'video' : 'image');
    }
  }, [initialVideoUrl, videoUrl]);

  const generateVideo = async () => {
    try {
      setVideoState('generating');
      toast.info('Generating video from image...');

      // Use the story context for video generation
      console.log('[ImageVideoOverlay] Using story context for video generation:', storyContext ? 'YES' : 'NO');

      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: imageSrc,
          prompt: `Create a short, engaging video animation based on this image. ${imageAlt ? `The image shows: ${imageAlt}` : ''}`,
          storyContext: storyContext,
          bookId: bookId,
          bookTitle: bookTitle,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate video');
      }

      const data = await response.json();
      
      if (data.videoUrl) {
        setVideoUrl(data.videoUrl);
        setVideoState('video');
        onVideoGenerated?.(data.videoUrl);
        toast.success('Video generated successfully!');
      } else {
        throw new Error('No video URL received');
      }
    } catch (error) {
      console.error('Error generating video:', error);
      setVideoState('image');
      toast.error('Failed to generate video. Please try again.');
    }
  };

  const playVideo = () => {
    if (videoRef.current && videoUrl) {
      setVideoState('playing');
      videoRef.current.play();
    }
  };

  const pauseVideo = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      setVideoState('video');
    }
  };

  const handleVideoEnd = () => {
    setVideoState('video');
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const renderOverlayButton = () => {
    switch (videoState) {
      case 'image':
        return (
          <Button
            onClick={generateVideo}
            className="bg-black/70 hover:bg-black/80 text-white border-none backdrop-blur-sm transition-all duration-200"
            size="sm"
          >
            <VideoIcon size={16} />
            Create Video
          </Button>
        );
      
      case 'generating':
        return (
          <Button
            disabled
            className="bg-black/70 text-white border-none backdrop-blur-sm cursor-not-allowed"
            size="sm"
          >
            <LoaderIcon size={16} className="mr-2 animate-spin" />
            Generating...
          </Button>
        );
      
      case 'video':
        return (
          <div className="flex gap-2">
            <Button
              onClick={playVideo}
              className="bg-black/70 hover:bg-black/80 text-white border-none backdrop-blur-sm transition-all duration-200"
              size="sm"
            >
              <PlayIcon size={16} />
              Play Video
            </Button>
            <Button
              onClick={toggleMute}
              className="bg-black/70 hover:bg-black/80 text-white border-none backdrop-blur-sm transition-all duration-200"
              size="sm"
            >
              {isMuted ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </Button>
          </div>
        );
      
      case 'playing':
        return (
          <div className="flex gap-2">
            <Button
              onClick={pauseVideo}
              className="bg-black/70 hover:bg-black/80 text-white border-none backdrop-blur-sm transition-all duration-200"
              size="sm"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
                <rect x="6" y="4" width="4" height="16" fill="currentColor"/>
                <rect x="14" y="4" width="4" height="16" fill="currentColor"/>
              </svg>
              Pause
            </Button>
            <Button
              onClick={toggleMute}
              className="bg-black/70 hover:bg-black/80 text-white border-none backdrop-blur-sm transition-all duration-200"
              size="sm"
            >
              {isMuted ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </Button>
          </div>
        );
    }
  };

  return (
    <div 
      className={`relative group ${isFullPage ? 'w-full h-full' : 'inline-block'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={isFullPage ? {
        width: '100%',
        height: '100%'
      } : {}}
    >
      {/* Image */}
      {(videoState === 'image' || videoState === 'generating') && (
        <img
          src={imageSrc}
          alt={imageAlt}
          className={`${isFullPage 
            ? 'w-full h-full object-cover' 
            : 'max-w-full h-auto rounded'
          } book-image transition-all duration-300 ${videoState === 'generating' ? 'opacity-75' : ''}`}
          style={isFullPage ? {
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '0',
            margin: '0',
            padding: '0',
            display: 'block'
          } : {}}

        />
      )}

      {/* Video */}
      {(videoState === 'video' || videoState === 'playing') && videoUrl && (
        <video
          ref={videoRef}
          src={videoUrl}
          className={`${isFullPage 
            ? 'w-full h-full object-cover' 
            : 'max-w-full h-auto rounded'
          } book-video`}
          onEnded={handleVideoEnd}
          muted={isMuted}
          playsInline
          style={isFullPage ? {
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '0',
            margin: '0',
            padding: '0',
            display: 'block'
          } : {}}
        />
      )}

      {/* Hover Overlay */}
      <div className={`absolute inset-0 bg-black/20 flex items-center justify-center transition-opacity duration-200 ${
        isHovered || videoState === 'generating' ? 'opacity-100' : 'opacity-0'
      }`}>
        {renderOverlayButton()}
      </div>

      {/* Generation Progress Indicator */}
      {videoState === 'generating' && (
        <div className="absolute bottom-4 left-4 right-4">
          <div className="bg-black/70 text-white text-xs px-3 py-2 rounded-full backdrop-blur-sm">
            <div className="flex items-center space-x-2">
              <LoaderIcon size={12} className="animate-spin" />
              <span>Creating your video...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
