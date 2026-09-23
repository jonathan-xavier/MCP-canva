import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('http://127.0.0.1:5173'),
  title: 'Ateliê Canva — transforme ideias em campanhas',
  description: 'Crie banners no Canva a partir de um briefing, compare opções e exporte o design escolhido.',
  openGraph: {
    title: 'Ateliê Canva',
    description: 'Ideias viram campanhas.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Ateliê Canva — Ideias viram campanhas.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ateliê Canva',
    description: 'Ideias viram campanhas.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
