import { readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 递归列出目录下所有文件的相对路径（统一使用 / 分隔）。
 *
 * @param {string} dir 目录
 * @param {string} [prefix] 内部递归使用的前缀
 * @returns {string[]}
 */
export function listFiles(dir, prefix = '') {
  const files = []

  for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true })) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name

    if (entry.isDirectory()) {
      files.push(...listFiles(dir, relativePath))
    } else if (entry.isFile()) {
      files.push(relativePath)
    } else {
      throw new Error(`不支持的文件类型: ${relativePath}`)
    }
  }

  return files
}
