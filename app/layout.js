import './globals.css';

export const metadata = {
  title: 'Assistente de Estudo',
  description: 'Gerador automático de respostas para o estudo da semana',
};

export const viewport = {
  themeColor: '#f8fafc',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
