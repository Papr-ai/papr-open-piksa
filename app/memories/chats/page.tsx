import { redirect } from 'next/navigation';

export default function ChatsRedirectPage() {
  // Redirect to collections page
  redirect('/memories/collections');
}
