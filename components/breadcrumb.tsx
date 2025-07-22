'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useBreadcrumb } from './breadcrumb-context';

export function Breadcrumb() {
  const pathname = usePathname();
  const { title } = useBreadcrumb();
  const [segments, setSegments] = useState<Array<{ name: string; href: string }>>([]);
  
  useEffect(() => {
    if (!pathname) return;
    
    // Create path segments
    const paths = pathname.split('/').filter(Boolean);
    
    const breadcrumbSegments = paths.map((path, index) => {
      // Create the href for this segment
      const href = `/${paths.slice(0, index + 1).join('/')}`;
      
      // Format the name (capitalize, replace hyphens with spaces)
      let name = path.replace(/-/g, ' ');
      
      // Handle IDs in paths (like chat/[id])
      if (path.length > 8 && path.match(/^[a-zA-Z0-9-_]+$/)) {
        if (title && index === paths.length - 1) {
          name = title;
        } else {
          name = path.length > 16 ? `${path.substring(0, 8)}...` : path;
        }
      } else {
        // Capitalize first letter
        name = name.charAt(0).toUpperCase() + name.slice(1);
      }
      
      return {
        name,
        href,
      };
    });

    // Add Home at the beginning
    setSegments([
      { name: 'Home', href: '/' },
      ...breadcrumbSegments,
    ]);
  }, [pathname, title]);

  if (segments.length <= 1) return null;

  return (
    <div className=" w-[100%]">
    <nav className="flex h-12 px-5 py-2 text-base bg-transparent z-10 shrink-0 justify-center border-sidebar-border w-full">
      <ol className="flex items-center space-x-2 overflow-x-auto whitespace-nowrap  p-4 rounded-lg">
        {segments.map((segment, index) => (
          <Fragment key={segment.href}>
            {index > 0 && (
              <li className="flex items-center mx-1">
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </li>
            )}
            <li>
              {index === segments.length - 1 ? (
                <span className="font-semibold truncate max-w-[300px]" title={segment.name}>
                  {segment.name}
                </span>
              ) : (
                <Link 
                  href={segment.href}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {segment.name}
                </Link>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
    </div>
  );
} 