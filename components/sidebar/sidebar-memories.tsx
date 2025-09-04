import {
  SidebarGroup,
  SidebarGroupContent,
  useSidebar,
} from '@/components/ui/sidebar';
import { FileIcon, BoxIcon, BookOpen, PenTool, Users, Image } from 'lucide-react';
import type { User } from 'next-auth';
import Link from 'next/link';

export function SidebarPrimaryNav({ user }: { user: User | undefined }) {
  const { setOpenMobile } = useSidebar();

  if (!user) {
    return null;
  }

  return (
    <SidebarGroup className="mb-2">
      <SidebarGroupContent>
        <div className="space-y-1">
          <Link
            href="/books"
            className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded-md"
            onClick={() => setOpenMobile(false)}
          >
            <BookOpen size={16} />
            <span>My Books</span>
          </Link>

          <Link
            href="/books/new"
            className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded-md"
            onClick={() => setOpenMobile(false)}
          >
            <PenTool size={16} />
            <span>Start Writing</span>
          </Link>

          <Link
            href="/characters"
            className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded-md"
            onClick={() => setOpenMobile(false)}
          >
            <Users size={16} />
            <span>Characters</span>
          </Link>

          <Link
            href="/illustrations"
            className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded-md"
            onClick={() => setOpenMobile(false)}
          >
            <Image size={16} />
            <span>Illustrations</span>
          </Link>

        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
