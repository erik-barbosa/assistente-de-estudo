export default function manifest() {
  return {
    name: 'Assistente de Estudo',
    short_name: 'Estudo',
    description: 'Gerador automático de respostas para o estudo da semana',
    lang: 'pt-BR',
    start_url: '/',
    display: 'standalone',
    background_color: '#f2f5f4',
    theme_color: '#f2f5f4',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
