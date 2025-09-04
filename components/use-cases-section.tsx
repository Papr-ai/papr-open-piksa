'use client';

import { useRef, useEffect, useState } from 'react';

export function UseCasesSection() {
  const useCasesRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  
  const scrollToUseCases = () => {
    useCasesRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Set up intersection observer to detect when section is in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    
    if (useCasesRef.current) {
      observer.observe(useCasesRef.current);
    }
    
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <>
      {/* Explore use cases button - fixed at the very bottom of the screen */}
      <div 
        onClick={scrollToUseCases}
        className="justify-center items-center p-1 h-9 min-w-[42px] min-h-9 fixed bottom-4 left-1/2 transform -translate-x-1/2 gap-[2px] cursor-pointer hover:opacity-80 hover:duration-150 flex z-10 bg-background/80 backdrop-blur-sm rounded-full shadow-sm"
      >
        <div className="text-muted-foreground select-none text-[13px] leading-[18px]">Explore use cases</div>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 13L8 9L12 13" stroke="#858481" strokeWidth="0.886667" strokeLinecap="round" strokeLinejoin="round"></path>
          <path d="M4 9L8 5L12 9" stroke="#B9B9B7" strokeWidth="0.886667" strokeLinecap="round" strokeLinejoin="round"></path>
        </svg>
      </div>

      {/* Add spacing to ensure content doesn't get hidden behind fixed button */}
      <div className="h-24"></div>

      {/* Use cases section */}
      <div 
        ref={useCasesRef} 
        className={`flex flex-col pb-[100px] px-10 max-md:pb-[64px] max-md:px-[2px] mt-[60px] transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="flex items-start flex-row justify-between">
          <div className="flex items-center justify-center flex-wrap flex-1 gap-2">
            <button className="rounded-full flex items-center clickable border hover:bg-background transition-colors !bg-primary border-primary font-medium px-3 py-[5.25px] 1.5xl:py-[6.5px]">
              <span className="flex justify-center items-center relative text-primary-foreground text-[13px] 1.5xl:text-[14px]">
                <span className="font-medium opacity-0">Featured</span>
                <span className="flex w-full h-full whitespace-nowrap absolute justify-center">Featured</span>
              </span>
            </button>
            <button className="rounded-full flex items-center clickable border border-border hover:bg-background transition-colors px-3 py-[5.25px] 1.5xl:py-[6.5px]">
              <span className="flex justify-center items-center relative text-muted-foreground text-[13px] 1.5xl:text-[14px]">
                <span className="font-medium opacity-0">Research</span>
                <span className="flex w-full h-full whitespace-nowrap absolute justify-center">Research</span>
              </span>
            </button>
            <button className="rounded-full flex items-center clickable border border-border hover:bg-background transition-colors px-3 py-[5.25px] 1.5xl:py-[6.5px]">
              <span className="flex justify-center items-center relative text-muted-foreground text-[13px] 1.5xl:text-[14px]">
                <span className="font-medium opacity-0">Productivity</span>
                <span className="flex w-full h-full whitespace-nowrap absolute justify-center">Productivity</span>
              </span>
            </button>
          </div>
        </div>
        
        <p className="my-3 text-center text-muted text-[10px] leading-[20px]">All community content is voluntarily shared by users and will not be displayed without consent.</p>
        
        <div className="relative">
          <div className="flex flex-row flex-wrap gap-2 md:gap-4 [&>*]:w-[calc((100%-0.5rem)/2)] [&>*]:sm:w-[calc((100%-1rem)/2)] relative">
            {/* Example use case card 1 - Children's Book */}
            <div className={`flex relative flex-col gap-1 items-start p-4 cursor-pointer min-h-[150px] group/item-btns border rounded-[12px] border-border bg-card transition-all duration-500 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`} style={{ transitionDelay: '100ms' }}>
              <div className="flex-1 w-full min-h-[44px]">
                <span className="text-ellipsis break-words line-clamp-3 text-sm text-foreground">The Magical Forest Adventure: Complete Children&apos;s Book with Illustrations</span>
              </div>
              <div className="flex items-center gap-1.5 group-hover/item-btns:hidden">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="16" height="16" className="text-muted-foreground">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="text-muted-foreground text-[13px] leading-[18px] truncate">Picture Book</div>
              </div>
              <div className="w-full absolute bottom-0 left-0 min-h-[127px] hidden group-hover/item-btns:flex items-end justify-center bg-[linear-gradient(180deg,transparent_0%,hsl(var(--card))_50%)] px-[16px] pb-[16px]">
                <button className="inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring hover:opacity-90 active:opacity-80 bg-primary text-primary-foreground h-[32px] px-[8px] gap-[4px] text-[13px] leading-[18px] rounded-[100px] w-full">
                  <svg height="20" width="20" fill="none" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.5 10C17.5 11.4834 17.0601 12.9334 16.236 14.1668C15.4119 15.4001 14.2406 16.3614 12.8701 16.9291C11.4997 17.4968 9.99168 17.6453 8.53683 17.3559C7.08197 17.0665 5.7456 16.3522 4.6967 15.3033C3.64781 14.2544 2.9335 12.918 2.64411 11.4632C2.35472 10.0083 2.50325 8.50032 3.07091 7.12987C3.63856 5.75943 4.59986 4.58809 5.83323 3.76398C7.0666 2.93987 8.51664 2.5 10 2.5C12.1 2.5 14.1083 3.33333 15.6167 4.78333L17.5 6.66667" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667"></path>
                    <path d="M17.5007 2.5V6.66667H13.334" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667"></path>
                    <path d="M12.5419 9.37138C13.0259 9.65082 13.0259 10.3494 12.5419 10.6289L9.27486 12.5151C8.79086 12.7945 8.18586 12.4452 8.18586 11.8863L8.18586 8.11391C8.18586 7.55504 8.79086 7.20574 9.27486 7.48518L12.5419 9.37138Z" fill="currentColor"></path>
                  </svg>
                  View example
                </button>
              </div>
            </div>
            
            {/* Example use case card 2 - Novel */}
            <div className={`flex relative flex-col gap-1 items-start p-4 cursor-pointer min-h-[150px] group/item-btns border rounded-[12px] border-border bg-card transition-all duration-500 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`} style={{ transitionDelay: '200ms' }}>
              <div className="flex-1 w-full min-h-[44px]">
                <span className="text-ellipsis break-words line-clamp-3 text-sm text-foreground">Character-Driven Fantasy Novel: World Building and Plot Development</span>
              </div>
              <div className="flex items-center gap-1.5 group-hover/item-btns:hidden">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="16" height="16" className="text-muted-foreground">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="text-muted-foreground text-[13px] leading-[18px] truncate">Novel</div>
              </div>
              <div className="w-full absolute bottom-0 left-0 min-h-[127px] hidden group-hover/item-btns:flex items-end justify-center bg-[linear-gradient(180deg,transparent_0%,hsl(var(--card))_50%)] px-[16px] pb-[16px]">
                <button className="inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring hover:opacity-90 active:opacity-80 bg-primary text-primary-foreground h-[32px] px-[8px] gap-[4px] text-[13px] leading-[18px] rounded-[100px] w-full">
                  <svg height="20" width="20" fill="none" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.5 10C17.5 11.4834 17.0601 12.9334 16.236 14.1668C15.4119 15.4001 14.2406 16.3614 12.8701 16.9291C11.4997 17.4968 9.99168 17.6453 8.53683 17.3559C7.08197 17.0665 5.7456 16.3522 4.6967 15.3033C3.64781 14.2544 2.9335 12.918 2.64411 11.4632C2.35472 10.0083 2.50325 8.50032 3.07091 7.12987C3.63856 5.75943 4.59986 4.58809 5.83323 3.76398C7.0666 2.93987 8.51664 2.5 10 2.5C12.1 2.5 14.1083 3.33333 15.6167 4.78333L17.5 6.66667" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667"></path>
                    <path d="M17.5007 2.5V6.66667H13.334" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667"></path>
                    <path d="M12.5419 9.37138C13.0259 9.65082 13.0259 10.3494 12.5419 10.6289L9.27486 12.5151C8.79086 12.7945 8.18586 12.4452 8.18586 11.8863L8.18586 8.11391C8.18586 7.55504 8.79086 7.20574 9.27486 7.48518L12.5419 9.37138Z" fill="currentColor"></path>
                  </svg>
                  View example
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 