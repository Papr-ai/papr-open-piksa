import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Usage Overview - PaprChat',
  description: 'View your current usage statistics and plan limits',
};

export default function UsageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
