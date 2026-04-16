const path = require('path')

const API_SERVER_PORT = process.env.API_SERVER_PORT || '19090'
const API_SERVER_URL = process.env.API_SERVER_URL || `http://127.0.0.1:${API_SERVER_PORT}`

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  experimental: {
    externalDir: true,
  },
  server: {
    allowedHosts: ['.monkeycode-ai.online'],
  },
  env: {
    NEXT_PUBLIC_API_BASE: API_SERVER_URL,
    NEXT_PUBLIC_API_V1_BASE: `${API_SERVER_URL}/api/v1`,
    NEXT_PUBLIC_WS_URL: `${API_SERVER_URL.replace('http:', 'ws:').replace('https:', 'wss:')}/ws/chat`,
    NEXT_PUBLIC_API_PREFIX: '/api/v1',
  },
  webpack: (config) => {
    config.resolve = config.resolve || {}
    config.resolve.alias = config.resolve.alias || {}
    config.resolve.alias['@'] = path.resolve(__dirname, 'src')
    config.resolve.alias['@ai-team/team-core'] = path.resolve(__dirname, '../packages/team-core/src/index.mjs')
    return config
  },
}
module.exports = nextConfig
