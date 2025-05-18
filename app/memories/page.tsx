import { redirect } from 'next/navigation';

export default function MemoriesPage() {
  // Redirect to collections page when user navigates to /memories
  redirect('/memories/collections');
}
