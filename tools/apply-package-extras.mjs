#!/usr/bin/env node

/**
 * 把 patches/package-extras.json 合并进上游 package.json。
 *
 * 依赖列表是上游改动最频繁的部分，一旦写进补丁，基准稍有漂移就会冲突。
 * 这里改成结构化合并：只追加/覆盖我们关心的键，与上游版本无关。
 *
 * 用法: node tools/apply-package-extras.mjs <extras.json> <package.json>
 */

import { readFileSync, writeFileSync } from 'node:fs'

const MERGEABLE_SECTIONS = [
  'scripts',
  'dependencies',
  'devDependencies',
  'resolutions',
  'overrides',
]

const [specArg, packageArg] = process.argv.slice(2)

if (!specArg || !packageArg) {
  console.log(
    '用法: node tools/apply-package-extras.mjs <extras.json> <package.json>'
  )
  process.exit(2)
}

const spec = JSON.parse(readFileSync(specArg, 'utf8'))
const pkg = JSON.parse(readFileSync(packageArg, 'utf8'))

const unknownSections = Object.keys(spec).filter(
  section => !MERGEABLE_SECTIONS.includes(section)
)

if (unknownSections.length > 0) {
  console.log(
    `::error::package-extras.json 包含不支持的字段: ${unknownSections.join(
      ', '
    )}（支持: ${MERGEABLE_SECTIONS.join(', ')}）`
  )
  process.exit(1)
}

const changes = []
const SORTED_SECTIONS = ['dependencies', 'devDependencies', 'resolutions', 'overrides']

/** 按字母序重建对象，和 yarn add 写入 package.json 的风格保持一致 */
function sortKeys(object) {
  return Object.fromEntries(
    Object.entries(object).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  )
}

for (const section of MERGEABLE_SECTIONS) {
  const extras = spec[section]

  if (!extras) {
    continue
  }

  const current = pkg[section] ?? {}

  for (const [key, value] of Object.entries(extras)) {
    const previous = current[key]

    if (previous !== value) {
      current[key] = value
      changes.push({
        key: `${section}.${key}`,
        previous,
        value,
      })
    }
  }

  pkg[section] = SORTED_SECTIONS.includes(section)
    ? sortKeys(current)
    : current
}

writeFileSync(packageArg, `${JSON.stringify(pkg, null, 2)}\n`)

if (changes.length === 0) {
  console.log('✅ package.json 已包含全部 extras，无需修改')
} else {
  console.log(`✅ 已合并 ${changes.length} 项 package.json 变更：`)
  for (const { key, previous, value } of changes) {
    console.log(
      previous === undefined
        ? `   - ${key}: ${value}（新增）`
        : `   - ${key}: ${previous} → ${value}`
    )
  }
}
