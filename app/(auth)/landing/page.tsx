'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ArrowUpIcon, PaperclipIcon, BrainIcon, ChevronDownIcon } from '@/components/common/icons';
import { LoginModal } from '@/components/auth/login-modal';
import { Plus, ChevronUp, FileText, Layers, MonitorSmartphone, BarChart2, MessageSquare, FileCode } from 'lucide-react';

// Simple tooltip component
function Tooltip({ children, content }: { children: React.ReactNode, content: string }) {
  const [isVisible, setIsVisible] = useState(false);
  
  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 px-2 py-1 rounded bg-black text-white text-xs whitespace-nowrap z-50">
          {content}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black"></div>
        </div>
      )}
    </div>
  );
}

// Creation type selector component
function CreationTypeSelector() {
  const [isOpen, setIsOpen] = useState(false);
  
  const creationTypes = [
    { id: 'chat', name: 'Chat', icon: MessageSquare },
    { id: 'document', name: 'Document', icon: FileText },
    { id: 'slides', name: 'Slides', icon: Layers },
    { id: 'webpage', name: 'Webpage', icon: MonitorSmartphone },
    { id: 'dashboard', name: 'Dashboard', icon: BarChart2 },
    { id: 'code', name: 'Code', icon: FileCode },
  ];
  
  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-fit px-2 text-xs flex items-center gap-1 rounded-full text-muted-foreground"
        onClick={() => setIsOpen(!isOpen)}
      >
        <MessageSquare className="h-4 w-4 mr-1" />
        <span className="text-xs">Chat</span>
        <ChevronDownIcon size={12} />
      </Button>
      
      {isOpen && (
        <div className="absolute bottom-full mb-2 right-0 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[150px] z-20">
          <div className="py-1 px-2 text-xs text-muted-foreground opacity-70">Create</div>
          {creationTypes.map((type) => (
            <div 
              key={type.id}
              className="py-1 px-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700 flex justify-between items-center"
            >
              <div className="flex items-center text-xs gap-2">
                <type.icon className="h-3.5 w-3.5" />
                {type.name}
              </div>
              {type.id === 'chat' && (
                <div className="text-foreground">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Simulate the Context dropdown that opens upwards
function ContextDropdown({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  
  return (
    <div className="absolute bottom-full mb-2 left-0 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 min-w-[200px] z-20">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md cursor-pointer">
          <PaperclipIcon className="h-4 w-4" />
          <span>Attach file</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md cursor-pointer">
          <Plus className="h-4 w-4" />
          <span>Add document context</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md cursor-pointer">
          <Plus className="h-4 w-4" />
          <span>Add chat context</span>
        </div>
      </div>
    </div>
  );
}

// Simplified model selector component
function ModelSelectorSimulation() {
  const [isOpen, setIsOpen] = useState(false);
  
  // Using the same models from lib/ai/models.ts
  const chatModels = [
    // Anthropic Models
    {
      id: 'claude-sonnet-4-20250514',
      name: 'Claude Sonnet 4',
      description: 'Balanced performance and reasoning',
      supportsReasoning: true,
      group: 'Anthropic',
    },
    {
      id: 'claude-3-7-sonnet-20250219',
      name: 'Claude 3.7',
      description: 'Anthropic\'s powerful reasoning model',
      supportsReasoning: true,
      group: 'Anthropic',
    },
    {
      id: 'claude-4-opus-20250514',
      name: 'Claude 4 Opus',
      description: 'Most advanced model for complex reasoning',
      supportsReasoning: true,
      group: 'Anthropic',
    },
    
    // OpenAI Models
    {
      id: 'gpt-5',
      name: 'GPT 5',
      description: 'OpenAI\'s flagship model',
      supportsReasoning: false,
      group: 'OpenAI',
    },
    {
      id: 'gpt-5-mini',
      name: 'GPT 5 Mini',
      description: 'Smaller, faster OpenAI model',
      supportsReasoning: false,
      group: 'OpenAI',
    },
    {
      id: 'o4-mini',
      name: 'OpenAI o4-mini',
      description: 'Optimized reasoning model',
      supportsReasoning: true,
      group: 'OpenAI',
    },
    
    // Google Models
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      description: 'Fast responses for general-purpose tasks',
      supportsReasoning: false,
      group: 'Google',
    },
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      description: 'Advanced reasoning for complex tasks',
      supportsReasoning: true,
      group: 'Google',
    },
  ];

  // Group models by provider
  const modelGroups = Object.entries(
    chatModels.reduce((acc, model) => {
      if (!acc[model.group]) {
        acc[model.group] = [];
      }
      acc[model.group].push(model);
      return acc;
    }, {} as Record<string, typeof chatModels>)
  );
  
  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-fit px-2 text-xs flex items-center gap-1 rounded-full text-muted-foreground"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-xs">Claude Sonnet 4</span>
        <ChevronDownIcon size={12} />
        <span className="text-xs text-blue-500 flex items-center">
        </span>
      </Button>
      
      {isOpen && (
        <div className="absolute bottom-full mb-2 right-0 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[180px] z-20">
          {modelGroups.map(([group, models]) => (
            <div key={group}>
              <div className="py-1 px-2 text-xs text-muted-foreground opacity-70">{group} Models</div>
              {models.map((model) => (
                <div 
                  key={model.id}
                  className="py-1 px-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700 flex justify-between items-center"
                >
                  <div className="flex items-center text-xs">
                    {model.name}
                    {model.supportsReasoning && (
                      <span className="ml-1 text-blue-500 flex items-center">
                        <BrainIcon size={8} />
                      </span>
                    )}
                  </div>
                  {model.id === 'claude-sonnet-4-20250514' && (
                    <div className="text-foreground">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
              {modelGroups.indexOf([group, models]) < modelGroups.length - 1 && (
                <div className="border-t border-gray-200 dark:border-gray-700 my-0.5"></div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Add web search icon component
function WebSearchToggleSimulation() {
  return (
    <Tooltip content="Enable Web Search">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 rounded-full p-[7px]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
        >
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeLinejoin="round"/>
          <ellipse cx="12" cy="12" rx="4" ry="10" stroke="currentColor" strokeLinejoin="round"/>
          <path d="M22 12H2" stroke="currentColor"/>
        </svg>
      </Button>
    </Tooltip>
  );
}

// Add memory toggle component that's enabled by default
function MemoryToggleSimulation() {
  // Use a unique ID for the gradient
  const gradientId = "memory-toggle-gradient";
  
  return (
    <Tooltip content="Disable Memory Search">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 rounded-full p-[7px] text-blue-500 dark:text-blue-400"
      >
        <svg width="20" height="24" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M9.16274 17.5H8.3294L9.16274 11.6667H6.24607C5.51274 11.6667 5.97107 11.0417 5.98774 11.0167C7.06274 9.11667 8.6794 6.28333 10.8377 2.5H11.6711L10.8377 8.33333H13.7627C14.0961 8.33333 14.2794 8.49167 14.0961 8.88333C10.8044 14.625 9.16274 17.5 9.16274 17.5Z"
            stroke={`url(#${gradientId})`}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={`url(#${gradientId})`}
          />
          <defs>
            <linearGradient
              id={gradientId}
              x1="5"
              y1="17"
              x2="14"
              y2="3"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#0060E0" />
              <stop offset="0.6" stopColor="#00ACFA" />
              <stop offset="1" stopColor="#0BCDFF" />
            </linearGradient>
          </defs>
        </svg>
      </Button>
    </Tooltip>
  );
}

function AddContextButtonSimulation() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs border border-dashed border-muted-foreground/30 rounded-full text-muted-foreground"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Plus className="mr-1 h-3 w-3" />
        Add Context
      </Button>
      <ContextDropdown isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
}

export default function LandingPage() {
  const [input, setInput] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [activeCategory, setActiveCategory] = useState('featured');
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const useCasesRef = useRef<HTMLElement>(null);

  // Adjust textarea height as user types
  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  };

  // Initialize height after mount
  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    adjustHeight();
  };

  // Show login modal when user submits
  const handleSubmit = () => {
    setShowLoginModal(true);
  };

  // Scroll to use cases section
  const scrollToUseCases = () => {
    useCasesRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Define use cases by category
  const useCases = {
    sales: [
      {
        title: "Dynamic Sales Playbook",
        description: "Pulls in your top-performing email sequences, pitch scripts and deal notes—combines them into an always-up-to-date guide.",
        tag: "Sales Enablement"
      },
      {
        title: "Pipeline Performance Dashboard",
        description: "Aggregates past deal metrics, stage-transition times and win rates to show live forecasts and friction points.",
        tag: "Analytics"
      },
      {
        title: "Account Insights Report",
        description: "Merges every conversation thread, support ticket and revenue history for each account into a single PDF or dashboard.",
        tag: "Account Management"
      },
      {
        title: "Follow-Up Email Generator",
        description: "Uses your stored outreach histories to recommend and draft the perfect next-step email for each prospect.",
        tag: "Outreach"
      },
      {
        title: "Win/Loss Analysis Report",
        description: "Auto-creates retrospectives by re-using past opportunity data, competitor notes and closing rationales.",
        tag: "Strategy"
      },
      {
        title: "Territory Opportunity Map",
        description: "Leverages historical regional sales data and customer feedback to highlight high-potential areas on a geo-visual map.",
        tag: "Planning"
      }
    ],
    engineering: [
      {
        title: "Technical Debt Dashboard",
        description: "Scans your memory for past ADRs, deprecated API calls and backlog items to show live technical debt hotspots.",
        tag: "Code Quality"
      },
      {
        title: "Bug Resolution Report",
        description: "Pulls in all linked bug tickets, logs, and patch notes—creates a timeline of how each issue was diagnosed and fixed.",
        tag: "Debugging"
      },
      {
        title: "ADR & Decision Catalog",
        description: "Compiles every Architecture Decision Record, design note and rationale into a searchable handbook.",
        tag: "Documentation"
      },
      {
        title: "Code Snippet Library",
        description: "Surfaces your own past snippets, utilities and patterns in-line as you code—no more hunting across repos.",
        tag: "Productivity"
      },
      {
        title: "Dependency Changelog",
        description: "Remembers every library upgrade and rollback you've ever made, summarizing \"why\" and \"when\" for audits or planning.",
        tag: "Maintenance"
      },
      {
        title: "Test Coverage Summary",
        description: "Gathers historical test results, coverage reports and flaky-test notes to highlight where you need more automated checks.",
        tag: "Testing"
      }
    ],
    writing: [
      {
        title: "PRD & Spec Draft",
        description: "Taps into your past specs, outlines and comments to auto-generate a first-pass Product Requirements Document.",
        tag: "Product"
      },
      {
        title: "Blog Series Planner",
        description: "Uses previous posts, research notes and performance metrics to suggest topics, sequence and keywords for your next series.",
        tag: "Content"
      },
      {
        title: "Template Repository",
        description: "Consolidates all your saved email, report and proposal templates into one searchable library—ready to clone and customize.",
        tag: "Organization"
      },
      {
        title: "Style & Tone Guide",
        description: "Pulls from your historical docs to build a living style guide with voice, formatting rules and boilerplate snippets.",
        tag: "Branding"
      },
      {
        title: "Case Study Generator",
        description: "Re-uses interview transcripts, metrics and quotes you've stored to draft polished customer-success stories in minutes.",
        tag: "Marketing"
      },
      {
        title: "Meeting Recap Digest",
        description: "Summarizes decisions, action items and context from all past calls into a single, shareable document so nothing slips through.",
        tag: "Collaboration"
      }
    ]
  };

  // Featured use cases - 2 from each category
  const featuredUseCases = [
    ...useCases.sales.slice(0, 2),
    ...useCases.engineering.slice(0, 2),
    ...useCases.writing.slice(0, 2)
  ];

  // Get the current use cases based on active category
  const currentUseCases = activeCategory === 'featured' ? featuredUseCases : useCases[activeCategory as keyof typeof useCases] || [];

  return (
    <>
      {/* Login Modal */}
      <LoginModal isOpen={showLoginModal} setIsOpen={setShowLoginModal} />
      
      {/* Header */}
      <header className="sticky top-0 z-10 flex rounded-lg justify-between items-center p-4 border-b border-gray-100 dark:border-gray-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm">
        <div className="flex items-center">
          <img src="/images/papr-logo.svg" alt="Papr Logo" className="h-6 mr-2" />
          <span className="text-xl font-bold">Papr</span>
          <nav className="ml-10 hidden md:flex items-center space-x-6">
          <Link href="#" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Overview</Link>
          <Link href="#usecases" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Use cases</Link>
          <Link href="#developers" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Developers</Link>
          <Link href="#benchmark" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Benchmark</Link>
          <Link href="#pricing" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Pricing</Link>
          <Link href="https://github.com/Papr-ai/papr-chat" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Open Source</Link>

        </nav>
        </div>

        <div className="flex items-center space-x-3">
          <Link 
            href="https://dashboard.papr.ai" 
            className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
          >
            Developer Login
          </Link>
          <Link 
            href="/login" 
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Sign in
          </Link>
          <Link 
            href="/register" 
            className="px-4 py-2 rounded-lg bg-black text-white dark:bg-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-100"
          >
            Sign up
          </Link>
        </div>
      </header>

      {/* Hero section with input */}
      <section className="flex flex-col bg-background items-center justify-center px-4 py-16 md:py-24 relative">
        <div className="max-w-4xl w-full text-center mb-10 mt-10">
          <h1 className="text-4xl font-bold mb-4">Hello, I&apos;m Pen</h1>
          <p className="text-2xl text-gray-600 dark:text-gray-300 mb-8">I remember stuff. What do you want to create? </p>
        </div>
        
        <div className="w-full max-w-2xl mx-auto">
          <div className="relative w-full flex flex-col gap-2 bg-background p-2 rounded-[15px] dark:border-zinc-700 shadow-sm" style={{
            boxShadow: '0 -2px 10px hsl(var(--ring) / 0.1)',
          }}>
            {/* Add Context Button */}
            <div className="flex flex-wrap items-center gap-1 mb-1">
              <AddContextButtonSimulation />
            </div>
            
            <div className="relative flex items-center w-full">
              <Textarea
                ref={textareaRef}
                tabIndex={0}
                placeholder="I want to create..."
                className="min-h-[40px] max-h-[120px] resize-none bg-background pr-20 py-2 pb-10 overflow-y-auto border-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                value={input}
                onChange={handleInput}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              
              <div className="absolute left-0 bottom-0 p-1 flex items-center gap-1">
                <ModelSelectorSimulation />
                <MemoryToggleSimulation />
                <WebSearchToggleSimulation />
              </div>
              
              <div className="absolute bottom-0 right-0 p-1">
                <Button
                  className="rounded-full p-1.5 h-8 w-8 bg-blue-500 hover:bg-blue-600 text-white"
                  onClick={handleSubmit}
                >
                  <ArrowUpIcon size={16} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Explore use cases section - positioned between hero and use cases */}
      <div className="flex justify-center items-center py-8 bg-background">
        <div 
          onClick={scrollToUseCases}
          className="justify-center items-center p-4 h-20 min-w-[42px] min-h-9 gap-[2px] cursor-pointer hover:opacity-80 hover:duration-150 flex explore-button"
        >
          <div className="text-muted-foreground select-none text-[13px] leading-[18px]">Explore use cases</div>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 13L8 9L12 13" stroke="#858481" strokeWidth="0.886667" strokeLinecap="round" strokeLinejoin="round"></path>
            <path d="M4 9L8 5L12 9" stroke="#B9B9B7" strokeWidth="0.886667" strokeLinecap="round" strokeLinejoin="round"></path>
          </svg>
        </div>
      </div>

      {/* Use cases section */}
      <section ref={useCasesRef} id="usecases" className="py-16 bg-gray-50 dark:bg-zinc-800">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="flex justify-center items-center mb-8">
            <div className="flex space-x-3 flex-wrap justify-center gap-2">
              <Button 
                variant={activeCategory === 'featured' ? "default" : "outline"} 
                size="sm" 
                className={activeCategory === 'featured' ? "bg-black text-white dark:bg-white dark:text-black rounded-full" : "rounded-full"}
                onClick={() => setActiveCategory('featured')}
              >
                Featured
              </Button>
              <Button 
                variant={activeCategory === 'sales' ? "default" : "outline"} 
                size="sm" 
                className={activeCategory === 'sales' ? "bg-black text-white dark:bg-white dark:text-black rounded-full" : "rounded-full"}
                onClick={() => setActiveCategory('sales')}
              >
                Sales
              </Button>
              <Button 
                variant={activeCategory === 'engineering' ? "default" : "outline"} 
                size="sm" 
                className={activeCategory === 'engineering' ? "bg-black text-white dark:bg-white dark:text-black rounded-full" : "rounded-full"}
                onClick={() => setActiveCategory('engineering')}
              >
                Engineering
              </Button>
              <Button 
                variant={activeCategory === 'writing' ? "default" : "outline"} 
                size="sm" 
                className={activeCategory === 'writing' ? "bg-black text-white dark:bg-white dark:text-black rounded-full" : "rounded-full"}
                onClick={() => setActiveCategory('writing')}
              >
                Writing
              </Button>
            </div>
          </div>
          
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
            All use cases are examples curated by the Papr team. 
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Dynamically render use cases based on selected category */}
            {currentUseCases.map((useCase, index) => (
              <div 
                key={`${activeCategory}-${index}`} 
                className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden use-case-card hover:shadow-md transition-shadow duration-300"
              >
                <div className="p-6">
                  <h3 className="font-bold mb-4">{useCase.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {useCase.description}
                  </p>
                  <div className="flex items-center mt-4">
                    <span className="text-sm text-gray-500 dark:text-gray-400">{useCase.tag}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex justify-center mt-10">
            <Button variant="outline" className="rounded-full flex items-center gap-2">
              Explore more use cases
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.14645 3.14645C8.34171 2.95118 8.65829 2.95118 8.85355 3.14645L12.8536 7.14645C13.0488 7.34171 13.0488 7.65829 12.8536 7.85355L8.85355 11.8536C8.65829 12.0488 8.34171 12.0488 8.14645 11.8536C7.95118 11.6583 7.95118 11.3417 8.14645 11.1464L11.2929 8H2.5C2.22386 8 2 7.77614 2 7.5C2 7.22386 2.22386 7 2.5 7H11.2929L8.14645 3.85355C7.95118 3.65829 7.95118 3.34171 8.14645 3.14645Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
            </Button>
          </div>
        </div>
      </section>

      {/* Developer section */}
      <section id="developers" className="py-16 bg-white dark:bg-zinc-900">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Built for Developers</h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Integrate powerful memory and retrieval capabilities into your applications with our developer-first APIs.
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left side - Features */}
            <div className="space-y-8">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Lightning-Fast Memory Retrieval</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Retrieve relevant information from vast datasets in milliseconds with our predictive memory APIs.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Easy Integration</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    RESTful APIs with comprehensive SDKs for Python, JavaScript, and more. Get started in minutes.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Top ranked retrieval</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Industry-leading retrieval accuracy ranked number 1 on Stanford benchmarks.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Scales with Your Growth</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    From prototype to production, handle millions of queries with automatic scaling.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Right side - Code example */}
            <div className="bg-gray-900 rounded-lg p-6 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <span className="text-gray-400 text-sm">memory_search.py</span>
              </div>
              <pre className="text-green-400 text-sm overflow-x-auto">
{`import papr_memory

# Initialize the client
client = papr_memory.Papr(api_key="your_api_key")

# Add memories with custom metadata
client.memory.add({
  "content": "Q4 sales increased 23% YoY",
  "metadata": {
    "custom_metadata": {
      "type": "sales", 
      "quarter": "Q4",
      "department": "enterprise",
      "confidence": 0.95
    }
  }
})

# Search your memories
results = client.memory.search(
  query="sales performance last quarter",
  limit=10
)

for result in results:
  print(f"Score: {result.score}")
  print(f"Content: {result.content}")
  print(f"Custom metadata: {result.metadata.custom_metadata}")
`}
              </pre>
            </div>
          </div>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4 mt-12">
            <div className="flex space-x-4">
              <Link 
                href="https://platform.papr.ai" 
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
              >
                View Documentation
              </Link>
              <Link 
                href="https://dashboard.papr.ai" 
                className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
              >
                Get API Keys
              </Link>
            </div>
            
            {/* SDK Links */}
            <div className="flex items-center space-x-4 text-sm">
              <span className="text-gray-500 dark:text-gray-400">SDKs:</span>
              <Link 
                href="https://github.com/Papr-ai/papr-pythonSDK" 
                className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                </svg>
                <span>Python</span>
              </Link>
              <Link 
                href="https://github.com/Papr-ai/papr-TypescriptSDK" 
                className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                </svg>
                <span>TypeScript</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Benchmark section */}
      <section id="benchmark" className="py-16 bg-white dark:bg-zinc-900">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Performance Benchmarks</h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Papr Memory outperforms leading models in retrieval accuracy across key metrics on the Stanford STARK evaluation MAG synthesized 10% data-set.
            </p>
          </div>
          
          <div className="relative w-full h-[500px] mb-8">
            {/* Chart container with margin for y-axis label */}
            <div className="w-full h-full pl-24"> {/* Increased left padding for y-axis label */}
              {/* Chart title */}
              <div className="text-center text-xl font-semibold text-gray-600 dark:text-gray-300 mb-4">
                Stanford STARK evaluation MAG 10%
              </div>
              
              {/* Y-axis label - positioned to the left of percentages */}
              <div className="absolute -left-4 top-1/2 -translate-y-1/2 transform -rotate-90 text-sm font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
                Retrieval Accuracy
              </div>
              
              {/* Chart content */}
              <div className="relative h-[400px] md:h-[400px] sm:h-[300px] border-b border-l border-gray-300 dark:border-gray-700">
                {/* Y-axis markers */}
                <div className="absolute left-0 top-0 h-full w-full">
                  {[0, 25, 50, 75, 100].map((value, i) => (
                    <div key={i} className="absolute w-full" style={{ bottom: `${value}%` }}>
                      <div className="absolute -left-10 -translate-y-1/2 text-xs text-gray-500">{value}%</div>
                      <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
                    </div>
                  ))}
                </div>
                
                {/* Chart bars - properly spaced and sized, growing from bottom up */}
                <div className="absolute left-0 bottom-0 w-full h-full flex px-4">
                  {/* Hit @1 group */}
                  <div className="flex-1 flex justify-center">
                    <div className="flex sm:space-x-0.5 md:space-x-1 h-full items-end">
                      <div className="w-[6px] sm:w-[7px] md:w-8 bg-blue-500 group relative" style={{ height: '81%' }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] md:text-xs font-bold text-blue-500">81%</div>
                        <div className="hidden group-hover:block absolute -top-12 left-1/2 -translate-x-1/2 bg-black text-white text-[8px] sm:text-xs p-1 rounded">
                          Papr1: 81%
                        </div>
                      </div>
                      <div className="w-[6px] sm:w-[7px] md:w-8 bg-gray-600 relative" style={{ height: '41%' }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] md:text-xs text-gray-600">41%</div>
                      </div>
                      <div className="w-[6px] sm:w-[7px] md:w-8 bg-gray-500 relative" style={{ height: '38%' }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] md:text-xs text-gray-500">38%</div>
                      </div>
                      <div className="w-[6px] sm:w-[7px] md:w-8 bg-gray-400 relative" style={{ height: '37%' }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] md:text-xs text-gray-500">37%</div>
                      </div>
                      <div className="w-[6px] sm:w-[7px] md:w-8 bg-gray-300 relative" style={{ height: '35%' }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] md:text-xs text-gray-500">35%</div>
                      </div>
                      <div className="w-[6px] sm:w-[7px] md:w-8 bg-gray-200 relative" style={{ height: '32%' }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] md:text-xs text-gray-500">32%</div>
                      </div>
                      <div className="w-[6px] sm:w-[7px] md:w-8 bg-gray-100 relative" style={{ height: '29%' }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] md:text-xs text-gray-500">29%</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Hit @5 group */}
                  <div className="flex-1 flex justify-center">
                    <div className="flex sm:space-x-0.5 md:space-x-1 h-full items-end">
                      <div className="w-[6px] sm:w-[7px] md:w-8 bg-blue-500 group relative" style={{ height: '86%' }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] md:text-xs font-bold text-blue-500">86%</div>
                        <div className="hidden group-hover:block absolute -top-12 left-1/2 -translate-x-1/2 bg-black text-white text-[8px] sm:text-xs p-1 rounded">
                          Papr1: 86%
                        </div>
                      </div>
                      <div className="w-[6px] sm:w-[7px] md:w-8 bg-gray-600 relative" style={{ height: '58%' }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] md:text-xs text-gray-600">58%</div>
                      </div>
                      <div className="w-[6px] sm:w-[7px] md:w-8 bg-gray-500 relative" style={{ height: '59%' }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] md:text-xs text-gray-500">59%</div>
                      </div>
                      <div className="w-[6px] sm:w-[7px] md:w-8 bg-gray-400 relative" style={{ height: '53%' }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] md:text-xs text-gray-500">53%</div>
                      </div>
                      <div className="w-[6px] sm:w-[7px] md:w-8 bg-gray-300 relative" style={{ height: '51%' }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] md:text-xs text-gray-500">51%</div>
                      </div>
                      <div className="w-[6px] sm:w-[7px] md:w-8 bg-gray-200 relative" style={{ height: '47%' }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] md:text-xs text-gray-500">47%</div>
                      </div>
                      <div className="w-[6px] sm:w-[7px] md:w-8 bg-gray-100 relative" style={{ height: '47%' }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] md:text-xs text-gray-500">47%</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Recall @20 group */}
                  <div className="flex-1 flex justify-center">
                    <div className="flex sm:space-x-0.5 md:space-x-1 h-full items-end">
                      <div className="w-[6px] sm:w-[7px] md:w-8 bg-blue-500 group relative" style={{ height: '76%' }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] md:text-xs font-bold text-blue-500">76%</div>
                        <div className="hidden group-hover:block absolute -top-12 left-1/2 -translate-x-1/2 bg-black text-white text-[8px] sm:text-xs p-1 rounded">
                          Papr1: 76%
                        </div>
                      </div>
                      <div className="w-[6px] sm:w-[7px] md:w-8 bg-gray-600 relative" style={{ height: '49%' }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] md:text-xs text-gray-600">49%</div>
                      </div>
                      <div className="w-[6px] sm:w-[7px] md:w-8 bg-gray-500 relative" style={{ height: '48%' }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] md:text-xs text-gray-500">48%</div>
                      </div>
                      <div className="w-[6px] sm:w-[7px] md:w-8 bg-gray-400 relative" style={{ height: '51%' }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] md:text-xs text-gray-500">51%</div>
                      </div>
                      <div className="w-[6px] sm:w-[7px] md:w-8 bg-gray-300 relative" style={{ height: '49%' }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] md:text-xs text-gray-500">49%</div>
                      </div>
                      <div className="w-[6px] sm:w-[7px] md:w-8 bg-gray-200 relative" style={{ height: '46%' }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] md:text-xs text-gray-500">46%</div>
                      </div>
                      <div className="w-[6px] sm:w-[7px] md:w-8 bg-gray-100 relative" style={{ height: '46%' }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] md:text-xs text-gray-500">46%</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* MRR group */}
                  <div className="flex-1 flex justify-center">
                    <div className="flex sm:space-x-0.5 md:space-x-1 h-full items-end">
                      <div className="w-[6px] sm:w-[7px] md:w-8 bg-blue-500 group relative" style={{ height: '83%' }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] md:text-xs font-bold text-blue-500">83%</div>
                        <div className="hidden group-hover:block absolute -top-12 left-1/2 -translate-x-1/2 bg-black text-white text-[8px] sm:text-xs p-1 rounded">
                          Papr1: 83%
                        </div>
                      </div>
                      <div className="w-[6px] sm:w-[7px] md:w-8 bg-gray-600 relative" style={{ height: '49%' }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] md:text-xs text-gray-600">49%</div>
                      </div>
                      <div className="w-[6px] sm:w-[7px] md:w-8 bg-gray-500 relative" style={{ height: '48%' }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] md:text-xs text-gray-500">48%</div>
                      </div>
                      <div className="w-[6px] sm:w-[7px] md:w-8 bg-gray-400 relative" style={{ height: '44%' }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] md:text-xs text-gray-500">44%</div>
                      </div>
                      <div className="w-[6px] sm:w-[7px] md:w-8 bg-gray-300 relative" style={{ height: '41%' }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] md:text-xs text-gray-500">41%</div>
                      </div>
                      <div className="w-[6px] sm:w-[7px] md:w-8 bg-gray-200 relative" style={{ height: '39%' }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] md:text-xs text-gray-500">39%</div>
                      </div>
                      <div className="w-[6px] sm:w-[7px] md:w-8 bg-gray-100 relative" style={{ height: '39%' }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] md:text-xs text-gray-500">39%</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* X-axis labels - positioned below the chart */}
                <div className="absolute w-full -bottom-10 flex justify-around">
                  <div className="flex-1 text-center">
                    <div className="pt-2 text-xs sm:text-sm font-medium">Hit @1</div>
                  </div>
                  <div className="flex-1 text-center">
                    <div className="pt-2 text-xs sm:text-sm font-medium">Hit @5</div>
                  </div>
                  <div className="flex-1 text-center">
                    <div className="pt-2 text-xs sm:text-sm font-medium">Recall @20</div>
                  </div>
                  <div className="flex-1 text-center">
                    <div className="pt-2 text-xs sm:text-sm font-medium">MRR</div>
                  </div>
                </div>
              </div>
              
              {/* Legend */}
              <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mt-16">
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 bg-blue-500"></div>
                  <span className="text-xs sm:text-sm">Papr1</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 bg-gray-600"></div>
                  <span className="text-xs sm:text-sm">GPT 4 Reranker</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 bg-gray-500"></div>
                  <span className="text-xs sm:text-sm">GritLM-7b</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 bg-gray-400"></div>
                  <span className="text-xs sm:text-sm">Claude3 Reranker</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 bg-gray-300"></div>
                  <span className="text-xs sm:text-sm">voyage-12-instruct</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 bg-gray-200"></div>
                  <span className="text-xs sm:text-sm">colBERTv2</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 bg-gray-100"></div>
                  <span className="text-xs sm:text-sm">ada-002</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-center mt-16 px-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-4xl mx-auto mb-6">
              Benchmarks conducted in April 2024. Results show Papr Memory significantly outperforms other models in retrieval tasks.
            </p>
            <Button variant="outline" className="mt-2 sm:mt-6 rounded-full" onClick={() => window.open('https://huggingface.co/spaces/snap-stanford/stark-leaderboard', '_blank')}>
              Stanford&apos;s STARK Leaderboard
            </Button>
          </div>
        </div>
      </section>

      {/* Pricing section */}
      <section id="pricing" className="py-16 bg-gray-50 dark:bg-zinc-800">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Choose the plan that fits your needs. Start free and scale as you grow.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Free Plan */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold mb-2">Free</h3>
                <div className="text-3xl font-bold mb-1">$0</div>
                <p className="text-gray-500 dark:text-gray-400">Perfect for trying out Papr</p>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  100 messages per month
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Basic memory storage
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Community support
                </li>
              </ul>
              <Button className="w-full" variant="outline">Get Started Free</Button>
            </div>

            {/* Pro Plan */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border-2 border-blue-500 p-8 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">Most Popular</span>
              </div>
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold mb-2">Starter</h3>
                <div className="text-3xl font-bold mb-1">$20</div>
                <p className="text-gray-500 dark:text-gray-400">per month</p>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  1,200 messages per month
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Advanced memory features
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Priority support
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  All AI models
                </li>
              </ul>
              <Button className="w-full bg-blue-500 hover:bg-blue-600">Start Starter Trial</Button>
            </div>

            {/* Pro Plan */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold mb-2">Pro</h3>
                <div className="text-3xl font-bold mb-1">$200</div>
                <p className="text-gray-500 dark:text-gray-400">per month</p>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Unlimited basic messages
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  3,000 premium interactions
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  100K memories stored
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Priority support
                </li>
              </ul>
              <Button className="w-full" variant="outline">Start Pro Trial</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <img src="/images/papr-logo.svg" alt="Papr Logo" className="h-6 mr-2" />
                <span className="text-xl font-bold">Papr</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">© 2025 Papr AI</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Headquartered in San Francisco</p>
            </div>
            
            <div>
              <h3 className="font-medium mb-4">Company</h3>
              <ul className="space-y-3">
                <li><Link href="#" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm">About us</Link></li>
                <li><Link href="#" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm">Careers</Link></li>
                <li><Link href="#" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm">Terms of service</Link></li>
                <li><Link href="#" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm">Privacy policy</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium mb-4">Resources</h3>
              <ul className="space-y-3">
                <li><Link href="#" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm">Documentation</Link></li>
                <li><Link href="#" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm">Playbook</Link></li>
                <li><Link href="#" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm">Blog</Link></li>
                <li><Link href="#" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm">Help center</Link></li>
                <li><Link href="#pricing" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm">Pricing</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium mb-4">Developers</h3>
              <ul className="space-y-3">
                <li><Link href="https://platform.papr.ai" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm">API Documentation</Link></li>
                <li><Link href="https://dashboard.papr.ai" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm">Developer Dashboard</Link></li>
                <li><Link href="#" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm">API Status</Link></li>
                <li><Link href="https://github.com/Papr-ai/papr-pythonSDK" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm">Python SDK</Link></li>
                <li><Link href="https://github.com/Papr-ai/papr-TypescriptSDK" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm">TypeScript SDK</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium mb-4">Community</h3>
              <ul className="space-y-3">
                <li><Link href="#" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm">Discord</Link></li>
                <li><Link href="#" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm">LinkedIn</Link></li>
                <li><Link href="#" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm">X</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-10 pt-6 border-t border-gray-100 dark:border-gray-800">
            <div className="flex gap-4">
              <Link href="#" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 10c0 5.523-4.477 10-10 10S0 15.523 0 10 4.477 0 10 0s10 4.477 10 10z" fill="currentColor"/></svg>
              </Link>
              <Link href="#" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 10c0 5.523-4.477 10-10 10S0 15.523 0 10 4.477 0 10 0s10 4.477 10 10z" fill="currentColor"/></svg>
              </Link>
              <Link href="#" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 10c0 5.523-4.477 10-10 10S0 15.523 0 10 4.477 0 10 0s10 4.477 10 10z" fill="currentColor"/></svg>
              </Link>
            </div>
            
            <div className="mt-8 text-center">
              <p className="text-gray-400 italic">&quot;Creating a more enlightened future.&quot;</p>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}