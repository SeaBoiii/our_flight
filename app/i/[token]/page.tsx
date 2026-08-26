import type { Metadata } from 'next';
import InvitationExperience from './InvitationExperience';

export const metadata: Metadata = {
  title: 'Aleem & Nurulain — Wedding Invitation',
  description: 'A private wedding invitation for guests of Aleem and Nurulain.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Aleem & Nurulain — Wedding Invitation',
    description: 'Your invitation is ready for boarding.',
    images: [{ url: '/og.jpg', width: 1200, height: 630, alt: 'Aleem and Nurulain wedding invitation above the clouds' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aleem & Nurulain — Wedding Invitation',
    description: 'Your invitation is ready for boarding.',
    images: ['/og.jpg'],
  },
};

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InvitationExperience token={token} />;
}
