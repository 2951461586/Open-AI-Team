const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  experimental: {
    externalDir: true,
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
