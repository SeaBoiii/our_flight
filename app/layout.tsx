import type { Metadata } from 'next';
import './globals.css';

const siteOrigin = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: 'Aleem & Nurulain · Our Flight',
  description: 'A private flight-themed wedding invitation for Aleem and Nurulain.',
  robots: { index: false, follow: false },
  icons: { icon: [{ url: '/favicon.png', type: 'image/png' }] },
  openGraph: {
    type: 'website',
    title: 'Aleem & Nurulain · Our Flight',
    description: '22 August 2027 · Crowne Plaza Changi Airport',
    images: [{ url: '/og.jpg', width: 1200, height: 630, alt: 'Aleem and Nurulain wedding invitation above the clouds' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aleem & Nurulain · Our Flight',
    description: '22 August 2027 · Crowne Plaza Changi Airport',
    images: ['/og.jpg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
