#!/usr/bin/env node

/**
 * 在当前上游源码树中重新生成 patches/0001-linux-code.patch。
 *
 * 补丁只应包含“对上游已有文件的修改”：
 *   - package.json     → 由 patches/package-extras.json 合并
 *   - overlay/ 下的文件 → 由 tools/apply-overlay.mjs 复制
 * 生成时会自动排除这些路径，保证它们不会重新进入补丁。
 *
 * 要求工作区的改动已经 `git add`（脚本内部使用 `git diff --cached`）。
 *
 * 用法: node tools/regenerate-patch.mjs [仓库根目录]   # 在上游源码树中执行
 */

import { execFileSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listFiles } from './lib/list-files.mjs'

const defaultRepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(process.argv[2] ?? defaultRepoRoot)

const overlayDir = join(repoRoot, 'overlay')
const patchPath = join(repoRoot, 'patches', '0001-linux-code.patch')

const excludedPaths = ['package.json']

if (existsSync(overlayDir)) {
  excludedPaths.push(...listFiles(overlayDir))
}

const args = ['diff', '--binary', '--full-index', '--cached', 'HEAD', '--', '.']

for (const path of excludedPaths) {
  args.push(`:(exclude)${path}`)
}

const patch = execFileSync('git', args, {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})

if (patch.trim() === '') {
  console.log('::error::没有可生成的改动，请先应用补丁并 `git add`')
  process.exit(1)
}

writeFileSync(patchPath, patch)

console.log(
  `✅ 已生成 ${patchPath}（已排除 package.json 与 ${excludedPaths.length - 1} 个 overlay 文件）`
)
