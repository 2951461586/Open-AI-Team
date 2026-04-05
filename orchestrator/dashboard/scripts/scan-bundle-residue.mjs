#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const rootArg = args.find((arg) => arg.startsWith('--root='))
const rootDir = path.resolve(process.cwd(), rootArg ? rootArg.slice('--root='.length) : '.next/static')
const patterns = args.filter((arg) => !arg.startsWith('--root='))
const defaultPatterns = [
  'TL 已给出新的局部规划。',
  'TL 分析',
  'TL 完成分析',
  'TL 做出决策',
  'ID：',
]
const needles = patterns.length > 0 ? patterns : defaultPatterns
const exts = new Set(['.js', '.html', '.txt', '.css'])
const hits = []

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full)
      continue
    }
    if (!exts.has(path.extname(entry.name))) continue
    const content = fs.readFileSync(full, 'utf8')
    for (const needle of needles) {
      const index = content.indexOf(needle)
      if (index === -1) continue
      hits.push({ file: path.relative(process.cwd(), full), needle, index })
    }
  }
}

if (!fs.existsSync(rootDir)) {
  console.error(`[scan:bundle] root not found: ${rootDir}`)
  process.exit(2)
}

walk(rootDir)
console.log(`[scan:bundle] root=${path.relative(process.cwd(), rootDir) || '.'}`)
console.log(`[scan:bundle] patterns=${needles.join(' | ')}`)
if (hits.length === 0) {
  console.log('[scan:bundle] clean')
  process.exit(0)
}
console.log(`[scan:bundle] hits=${hits.length}`)
for (const hit of hits) {
  console.log(`- ${hit.needle} @ ${hit.file}:${hit.index}`)
}
process.exit(1)
