import { Source_Sans_3, Source_Serif_4 } from 'next/font/google';
import './globals.css';

const fonteSans = Source_Sans_3({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const fonteSerif = Source_Serif_4({ subsets: ['latin'], variable: '--font-serif', display: 'swap' });

export const metadata = {
  title: 'Assistente de Estudo',
  description: 'Gerador automático de respostas para o estudo da semana',
  icons: { icon: '/icon-192.png', apple: '/apple-icon.png' },
  appleWebApp: { capable: true, title: 'Assistente de Estudo', statusBarStyle: 'default' },
};

export const viewport = {
  themeColor: '#f2f5f4',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${fonteSans.variable} ${fonteSerif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
