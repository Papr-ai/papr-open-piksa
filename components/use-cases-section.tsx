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
            {/* Example use case card 1 */}
            <div className={`flex relative flex-col gap-1 items-start p-4 cursor-pointer min-h-[150px] group/item-btns border rounded-[12px] border-border bg-card transition-all duration-500 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`} style={{ transitionDelay: '100ms' }}>
              <div className="flex-1 w-full min-h-[44px]">
                <span className="text-ellipsis break-words line-clamp-3 text-sm text-foreground">AI Agent Training for Productivity: Objectives, Concepts, and Practices</span>
              </div>
              <div className="flex items-center gap-1.5 group-hover/item-btns:hidden">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="16" height="16" className="text-muted-foreground">
                  <path d="M6.99976 5.9974V4.26406C6.99976 3.38041 7.7161 2.66406 8.59976 2.66406H15.3998C16.2834 2.66406 16.9998 3.38041 16.9998 4.26406V5.9974" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                  <path d="M5.00024 10V8C5.00024 6.89543 5.89567 6 7.00024 6H17.0002C18.1048 6 19.0002 6.89543 19.0002 8V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                  <path d="M19 10H5C3.89543 10 3 10.8954 3 12V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V12C21 10.8954 20.1046 10 19 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
                <div className="text-muted-foreground text-[13px] leading-[18px] truncate">Memory</div>
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
            
            {/* Example use case card 2 */}
            <div className={`flex relative flex-col gap-1 items-start p-4 cursor-pointer min-h-[150px] group/item-btns border rounded-[12px] border-border bg-card transition-all duration-500 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`} style={{ transitionDelay: '200ms' }}>
              <div className="flex-1 w-full min-h-[44px]">
                <span className="text-ellipsis break-words line-clamp-3 text-sm text-foreground">Document Analysis and Summarization with Memory</span>
              </div>
              <div className="flex items-center gap-1.5 group-hover/item-btns:hidden">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" width="16" height="16" className="text-muted-foreground">
                  <path d="M13.9998 3.85156C13.9996 3.69616 13.7809 3.33333 13.1847 3.33333H2.81494C2.21879 3.33333 2.00011 3.69616 1.99984 3.85156V12.1484L2.01025 12.2148C2.06009 12.3884 2.29281 12.6667 2.81494 12.6667H13.1847C13.7809 12.6667 13.9996 12.3038 13.9998 12.1484V3.85156ZM6.25895 5.04688C6.47058 4.92933 6.72919 4.93591 6.93473 5.0638L10.7446 7.43425C10.94 7.55597 11.0591 7.76979 11.0591 8C11.0591 8.23021 10.94 8.44403 10.7446 8.56576L6.93473 10.9362C6.72919 11.0641 6.47058 11.0707 6.25895 10.9531C6.04733 10.8356 5.91588 10.6125 5.91585 10.3704V5.62956C5.91588 5.38747 6.04733 5.16444 6.25895 5.04688ZM7.24919 9.16992L9.13005 8L7.24919 6.82943V9.16992ZM15.3332 12.1484C15.333 13.3021 14.2245 14 13.1847 14H2.81494C1.80763 14 0.735884 13.3451 0.669759 12.2552L0.666504 12.1484V3.85156C0.666689 2.69785 1.77515 2 2.81494 2H13.1847C14.2245 2 15.333 2.69785 15.3332 3.85156V12.1484Z" fill="currentColor"></path>
                </svg>
                <div className="text-muted-foreground text-[13px] leading-[18px] truncate">Document</div>
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