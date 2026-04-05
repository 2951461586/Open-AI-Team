import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Team Dashboard',
    short_name: 'Dashboard',
    description: 'Team collaboration dashboard for tasks, conversations, and delivery tracking.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fafafa',
    theme_color: '#1a1a2e',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}