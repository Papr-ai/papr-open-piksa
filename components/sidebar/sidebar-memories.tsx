import {
  SidebarGroup,
  SidebarGroupContent,
  useSidebar,
} from '@/components/ui/sidebar';
import { FileIcon, BoxIcon, DocumentIcon } from '@/components/common/icons';
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
            href="/memories/collections"
            className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded-md"
            onClick={() => setOpenMobile(false)}
          >
            <BoxIcon size={16} />
            <span>Collections</span>
          </Link>

          <Link
            href="/memories/pages"
            className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded-md"
            onClick={() => setOpenMobile(false)}
          >
            <FileIcon size={16} />
            <span>Artifacts</span>
          </Link>

          {/*<Link
            href="/memories/shelf"
            className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded-md"
            onClick={() => setOpenMobile(false)}
          >
            <DocumentIcon size={16} />
            <span>Library</span>
          </Link>*/}


        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
