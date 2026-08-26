import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Our Flight | Invitation Service',
  description: 'Private invitation service for Aleem and Nurulain.',
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-SG">
      <body>{children}</body>
    </html>
  );
}
