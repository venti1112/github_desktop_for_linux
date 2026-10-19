#!/usr/bin/env node

/**
 * 计算需要补构建的上游版本。
 *
 * 上游 Release 有两种容易互相矛盾的顺序：
 * - GitHub API 默认按 created_at；stable 的发布时间也可能晚于同版本的 beta；
 * - semver 顺序中，3.6.8-beta2 又高于 3.6.7。
 *
 * 只按其中一种顺序扫描都会漏版本，因此这里同时扫描两条时间线：
 * 1. 按 published_at 从新到旧：捕捉发布晚于 beta 的 stable；
 * 2. 按 semver 从高到低：捕捉 semver 更高但发布更早的 beta。
 *
 * 每条时间线都从最新开始，遇到本仓库已有的版本就停止；两边收集到的缺口
 * 取并集，再按发布时间从旧到新输出。
 *
 * 用法:
 *   node tools/find-missing-releases.mjs \
 *     --upstream upstream-releases.json \
 *     --local local-releases.json \
 *     [--active active-versions.json] \
 *     [--json]
 *
 * 三个输入文件都是 JSON 数组：前两个是 GitHub Releases API 的原始数据，
 * --active 是当前 queued / in_progress 构建的版本号数组。
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SEMVER_PATTERN =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

/**
 * 从 GitHub Release tag 中提取 semver 版本。
 *
 * 上游使用 `release-3.6.7`；同时接受裸版本，便于测试和未来格式变化。
 */
export function getReleaseVersion(tagName) {
  if (typeof tagName !== 'string') {
    return null
  }

  const trimmed = tagName.trim()
  const version = trimmed.startsWith('release-')
    ? trimmed.slice('release-'.length)
    : trimmed

  return SEMVER_PATTERN.test(version) ? version : null
}

function parseSemver(version) {
  const withoutBuild = version.split('+')[0]
  const dashIndex = withoutBuild.indexOf('-')
  const core =
    dashIndex === -1 ? withoutBuild : withoutBuild.slice(0, dashIndex)
  const prerelease =
    dashIndex === -1 ? [] : withoutBuild.slice(dashIndex + 1).split('.')

  return {
    core: core.split('.').map(part => Number(part)),
    prerelease,
  }
}

/**
 * 比较两个 semver 版本（忽略 build metadata）。
 *
 * 这里只需要处理上游实际使用的 `X.Y.Z[-pre]`，所以不引入 semver 依赖。
 */
export function compareSemver(leftVersion, rightVersion) {
  const left = parseSemver(leftVersion)
  const right = parseSemver(rightVersion)

  for (let index = 0; index < 3; index++) {
    if (left.core[index] !== right.core[index]) {
      return left.core[index] - right.core[index]
    }
  }

  if (left.prerelease.length === 0 && right.prerelease.length === 0) {
    return 0
  }
  if (left.prerelease.length === 0) {
    return 1
  }
  if (right.prerelease.length === 0) {
    return -1
  }

  const length = Math.max(left.prerelease.length, right.prerelease.length)

  for (let index = 0; index < length; index++) {
    const leftPart = left.prerelease[index]
    const rightPart = right.prerelease[index]

    if (leftPart === undefined) {
      return -1
    }
    if (rightPart === undefined) {
      return 1
    }

    const leftNumeric = /^\d+$/.test(leftPart)
    const rightNumeric = /^\d+$/.test(rightPart)

    if (leftNumeric && rightNumeric) {
      const difference = Number(leftPart) - Number(rightPart)

      if (difference !== 0) {
        return difference
      }
    } else if (leftNumeric) {
      return -1
    } else if (rightNumeric) {
      return 1
    } else if (leftPart !== rightPart) {
      return leftPart < rightPart ? -1 : 1
    }
  }

  return 0
}

function parseTimestamp(value) {
  const timestamp = Date.parse(value ?? '')
  return Number.isFinite(timestamp) ? timestamp : 0
}

function toTimelineEntry(release, index) {
  if (!release || release.draft === true) {
    return null
  }

  const version = getReleaseVersion(release.tag_name)

  if (version === null) {
    return null
  }

  const publishedAt = release.published_at || release.created_at || null
  const createdAt = release.created_at || release.published_at || null

  return {
    version,
    tag: release.tag_name,
    publishedAt,
    publishedTimestamp: parseTimestamp(publishedAt),
    createdTimestamp: parseTimestamp(createdAt),
    prerelease:
      release.prerelease === true || parseSemver(version).prerelease.length > 0,
    index,
  }
}

/**
 * 建立上游发布时间线（新 → 旧），并去掉重复版本。
 *
 * 同一天可能有多个 Release，tie-break 使用 created_at 和 API 原始顺序。
 * Node 的 Array#sort 是稳定排序，因此最终结果可重复。
 */
function buildUpstreamEntries(releases) {
  const timeline = []

  for (const [index, release] of (releases ?? []).entries()) {
    const entry = toTimelineEntry(release, index)

    if (entry !== null) {
      timeline.push(entry)
    }
  }

  timeline.sort(
    (a, b) =>
      b.publishedTimestamp - a.publishedTimestamp ||
      b.createdTimestamp - a.createdTimestamp ||
      a.index - b.index
  )

  const seen = new Set()
  const unique = []

  for (const entry of timeline) {
    if (!seen.has(entry.version)) {
      seen.add(entry.version)
      unique.push(entry)
    }
  }

  return unique
}

export function buildUpstreamTimeline(releases) {
  return buildUpstreamEntries(releases).map(
    ({ version, tag, publishedAt }) => ({
      version,
      tag,
      publishedAt,
    })
  )
}

function getLocalVersions(releases) {
  const versions = new Set()

  for (const release of releases ?? []) {
    if (release?.draft === true) {
      continue
    }

    const version = getReleaseVersion(release?.tag_name)

    if (version !== null) {
      versions.add(version)
    }
  }

  return versions
}

function getActiveVersions(versions) {
  const active = new Set()

  for (const value of versions ?? []) {
    const version = getReleaseVersion(String(value))

    if (version !== null) {
      active.add(version)
    }
  }

  return active
}

/**
 * 计算从上游最新版本到本仓库最近已构建版本之间的缺口。
 *
 * 返回值中的 missing 已经按发布时间从旧 → 新排序，可直接按顺序触发构建。
 * activeVersions 只影响是否派发，不影响停止点：正在构建但尚未发布的版本
 * 仍会被视为缺口。
 */
export function findMissingReleases({
  upstreamReleases = [],
  localReleases = [],
  activeVersions = [],
} = {}) {
  const timeline = buildUpstreamEntries(upstreamReleases)
  const local = getLocalVersions(localReleases)
  const active = getActiveVersions(activeVersions)

  const collectGap = entries => {
    const gap = []

    for (const entry of entries) {
      if (local.has(entry.version)) {
        break
      }

      gap.push(entry)
    }

    return gap
  }

  const publicationGap = collectGap(timeline)
  const semverTimeline = [...timeline].sort((a, b) =>
    compareSemver(b.version, a.version)
  )
  const semverGap = collectGap(semverTimeline)

  const publicationStop =
    timeline.find(entry => local.has(entry.version)) ?? null
  const semverStop =
    semverTimeline.find(entry => local.has(entry.version)) ?? null

  // 两条时间线各自都有盲区，缺口取并集。
  const gapByVersion = new Map()

  for (const entry of [...publicationGap, ...semverGap]) {
    gapByVersion.set(entry.version, entry)
  }

  const missing = []
  const skippedActive = []

  // 按发布时间从旧到新输出；timeline 是从新到旧。
  for (const entry of [...timeline].reverse()) {
    if (!gapByVersion.has(entry.version)) {
      continue
    }

    if (active.has(entry.version)) {
      skippedActive.push(entry.version)
    } else {
      missing.push(entry.version)
    }
  }

  let warning = null

  if (timeline.length === 0) {
    warning = '上游没有可用的非 draft Release。'
  } else if (local.size === 0) {
    warning = `本仓库还没有 Release，将构建全部 ${timeline.length} 个上游版本。`
  } else if (publicationStop === null && semverStop === null) {
    warning = '本仓库的 Release 不在上游时间线中，无法确定停止点；将构建全部上游版本。'
  }

  const latestStable =
    semverTimeline.find(entry => !entry.prerelease)?.version ?? null
  const latestPrerelease =
    semverTimeline.find(entry => entry.prerelease)?.version ?? null

  return {
    latest: timeline[0]?.version ?? null,
    latestTag: timeline[0]?.tag ?? null,
    latestPublishedAt: timeline[0]?.publishedAt ?? null,
    latestStable,
    latestPrerelease,
    stopAt: publicationStop?.version ?? null,
    stopAtTag: publicationStop?.tag ?? null,
    stopAtPublishedAt: publicationStop?.publishedAt ?? null,
    semverStopAt: semverStop?.version ?? null,
    totalUpstream: timeline.length,
    localVersionCount: local.size,
    missing,
    skippedActive,
    warning,
  }
}

function usage() {
  console.log(`用法:
  node tools/find-missing-releases.mjs \\
    --upstream upstream-releases.json \\
    --local local-releases.json \\
    [--active active-versions.json] \\
    [--json]

  --upstream  上游 Release API 的 JSON 数组
  --local     本仓库 Release API 的 JSON 数组
  --active    正在 queued / in_progress 的构建版本 JSON 数组
  --json      输出 JSON，便于 workflow 使用`)
}

function readJsonArray(path, label) {
  let data

  try {
    data = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(`${label} 读取失败（${path}）: ${error.message}`)
  }

  if (!Array.isArray(data)) {
    throw new Error(`${label} 必须是 JSON 数组（${path}）`)
  }

  return data
}

function parseArgs(argv) {
  const options = {
    upstream: null,
    local: null,
    active: null,
    json: false,
  }

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]

    if (arg === '--upstream' || arg === '--local' || arg === '--active') {
      const value = argv[++index]

      if (!value) {
        throw new Error(`${arg} 缺少文件路径`)
      }

      options[arg.slice(2)] = value
    } else if (arg === '--json') {
      options.json = true
    } else if (arg === '--help' || arg === '-h') {
      usage()
      process.exit(0)
    } else {
      throw new Error(`未知参数: ${arg}`)
    }
  }

  if (!options.upstream || !options.local) {
    throw new Error('必须提供 --upstream 和 --local')
  }

  return options
}

function printHuman(result) {
  const lines = [
    `上游最新发布（按时间）: ${result.latest ?? '（无）'}`,
    `上游最新正式版: ${result.latestStable ?? '（无）'}`,
    `上游最新预发布: ${result.latestPrerelease ?? '（无）'}`,
    `本地停止版本（发布时间线）: ${result.stopAt ?? '（未找到）'}`,
    `本地停止版本（semver）: ${result.semverStopAt ?? '（未找到）'}`,
    `上游 Release 数: ${result.totalUpstream}`,
    `本次缺口 (${result.missing.length}):`,
  ]

  if (result.missing.length === 0) {
    lines.push('  （无）')
  } else {
    for (const version of result.missing) {
      lines.push(`  - ${version}`)
    }
  }

  if (result.skippedActive.length > 0) {
    lines.push(`已在构建中，跳过 (${result.skippedActive.length}):`)
    for (const version of result.skippedActive) {
      lines.push(`  - ${version}`)
    }
  }

  if (result.warning) {
    lines.push(`警告: ${result.warning}`)
  }

  console.log(lines.join('\n'))
}

function main() {
  let options

  try {
    options = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(`::error::${error.message}`)
    usage()
    process.exit(2)
  }

  let upstreamReleases
  let localReleases
  let activeVersions

  try {
    upstreamReleases = readJsonArray(options.upstream, '上游 Release 文件')
    localReleases = readJsonArray(options.local, '本地 Release 文件')
    activeVersions = options.active
      ? readJsonArray(options.active, '正在构建的版本文件')
      : []
  } catch (error) {
    console.error(`::error::${error.message}`)
    process.exit(1)
  }

  const result = findMissingReleases({
    upstreamReleases,
    localReleases,
    activeVersions,
  })

  if (result.totalUpstream === 0) {
    console.error('::error::上游没有可用的非 draft Release，请检查 API 返回。')
    process.exit(1)
  }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    printHuman(result)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
