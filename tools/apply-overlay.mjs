#!/usr/bin/env node

/**
 * 把 overlay/ 中的文件原样复制到上游源码树。
 *
 * overlay 用来存放“新增文件”（打包脚本、图标等）。与补丁里的 `new file`
 * 段落相比，它不依赖补丁基准，任何上游 tag 都能直接复制。
 *
 * 若目标位置已存在同名文件则直接失败：这通常意味着上游自己增加了 Linux
 * 支持或同名实现，需要人工确认后再处理，而不是静默覆盖。
 *
 * 用法: node tools/apply-overlay.mjs <overlay 目录> <上游源码目录>
 */

import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  statSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { listFiles } from './lib/list-files.mjs'

const [overlayArg, targetArg] = process.argv.slice(2)

if (!overlayArg || !targetArg) {
  console.log('用法: node tools/apply-overlay.mjs <overlay 目录> <上游源码目录>')
  process.exit(2)
}

const overlayDir = resolve(overlayArg)
const targetDir = resolve(targetArg)

if (!existsSync(overlayDir)) {
  console.log(`::error::overlay 目录不存在: ${overlayDir}`)
  process.exit(1)
}

if (!existsSync(targetDir)) {
  console.log(`::error::上游源码目录不存在: ${targetDir}`)
  process.exit(1)
}

const files = listFiles(overlayDir)

if (files.length === 0) {
  console.log('::error::overlay 目录为空，请检查是否遗漏了文件')
  process.exit(1)
}

const collisions = files.filter(file => existsSync(join(targetDir, file)))

if (collisions.length > 0) {
  console.log('::error::overlay 与上游源码冲突：以下文件在上游已存在')
  for (const file of collisions) {
    console.log(`  - ${file}`)
  }
  console.log(
    '请确认上游是否已经自带这些文件；如已无用，请从 overlay/ 中删除对应文件后重试。'
  )
  process.exit(1)
}

for (const file of files) {
  const source = join(overlayDir, file)
  const destination = join(targetDir, file)

  mkdirSync(dirname(destination), { recursive: true })
  copyFileSync(source, destination)

  // 保留可执行位（postinst.sh / postrm.sh / post.sh / preun.sh）
  chmodSync(destination, statSync(source).mode & 0o777)
}

console.log(`✅ 已复制 ${files.length} 个 overlay 文件：`)
for (const file of files) {
  console.log(`   - ${file}`)
}
