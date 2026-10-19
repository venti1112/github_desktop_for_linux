import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildUpstreamTimeline,
  findMissingReleases,
  getReleaseVersion,
} from './find-missing-releases.mjs'

function release(version, publishedAt, overrides = {}) {
  return {
    tag_name: `release-${version}`,
    published_at: publishedAt,
    created_at: publishedAt,
    draft: false,
    prerelease: version.includes('-beta'),
    ...overrides,
  }
}

test('getReleaseVersion 接受上游 release- 前缀和裸版本', () => {
  assert.equal(getReleaseVersion('release-3.6.7'), '3.6.7')
  assert.equal(getReleaseVersion('3.6.8-beta2'), '3.6.8-beta2')
  assert.equal(
    getReleaseVersion('release-3.6.8-beta2+build.1'),
    '3.6.8-beta2+build.1'
  )
  assert.equal(getReleaseVersion('nightly'), null)
  assert.equal(getReleaseVersion('release-latest'), null)
  assert.equal(getReleaseVersion(null), null)
})

test('时间线按 published_at 排序，而不是 API 的 created_at 顺序', () => {
  const timeline = buildUpstreamTimeline([
    release('3.6.8-beta2', '2026-10-13T16:37:28Z'),
    release('3.6.8-beta1', '2026-10-13T11:41:07Z'),
    release('3.6.7', '2026-10-14T07:59:58Z'),
  ])

  assert.deepEqual(
    timeline.map(entry => entry.version),
    ['3.6.7', '3.6.8-beta2', '3.6.8-beta1']
  )
})

test('本仓库只有 beta2 时，能正确补 stable 3.6.7', () => {
  const result = findMissingReleases({
    upstreamReleases: [
      release('3.6.8-beta2', '2026-10-13T16:37:28Z'),
      release('3.6.8-beta1', '2026-10-13T11:41:07Z'),
      release('3.6.7', '2026-10-14T07:59:58Z'),
    ],
    localReleases: [
      release('3.6.8-beta2', '2026-10-13T16:37:28Z'),
    ],
  })

  assert.equal(result.stopAt, '3.6.8-beta2')
  assert.deepEqual(result.missing, ['3.6.7'])
  assert.equal(result.warning, null)
})

test('最新版本已经在本地时没有缺口', () => {
  const result = findMissingReleases({
    upstreamReleases: [
      release('3.6.8-beta2', '2026-10-13T16:37:28Z'),
      release('3.6.7', '2026-10-14T07:59:58Z'),
    ],
    localReleases: [
      release('3.6.8-beta2', '2026-10-13T16:37:28Z'),
      release('3.6.7', '2026-10-14T07:59:58Z'),
    ],
  })

  assert.equal(result.latest, '3.6.7')
  assert.equal(result.stopAt, '3.6.7')
  assert.deepEqual(result.missing, [])
})

test('多个缺口按旧 → 新排序', () => {
  const result = findMissingReleases({
    upstreamReleases: [
      release('3.6.8', '2026-10-20T10:00:00Z'),
      release('3.6.8-beta3', '2026-10-18T10:00:00Z'),
      release('3.6.7', '2026-10-14T07:59:58Z'),
      release('3.6.8-beta2', '2026-10-13T16:37:28Z'),
    ],
    localReleases: [
      release('3.6.8-beta2', '2026-10-13T16:37:28Z'),
    ],
  })

  assert.deepEqual(result.missing, ['3.6.7', '3.6.8-beta3', '3.6.8'])
  assert.equal(result.stopAt, '3.6.8-beta2')
})

test('已经在构建中的版本会跳过，但仍继续寻找本地停止点', () => {
  const result = findMissingReleases({
    upstreamReleases: [
      release('3.6.8', '2026-10-20T10:00:00Z'),
      release('3.6.8-beta3', '2026-10-18T10:00:00Z'),
      release('3.6.7', '2026-10-14T07:59:58Z'),
    ],
    localReleases: [
      release('3.6.7', '2026-10-14T07:59:58Z'),
    ],
    activeVersions: ['3.6.8'],
  })

  assert.deepEqual(result.missing, ['3.6.8-beta3'])
  assert.deepEqual(result.skippedActive, ['3.6.8'])
  assert.equal(result.stopAt, '3.6.7')
})

test('draft 和非法 tag 会被忽略，本地 draft 不算已构建', () => {
  const result = findMissingReleases({
    upstreamReleases: [
      release('3.6.9', '2026-10-21T10:00:00Z', { draft: true }),
      release('not-a-version', '2026-10-21T09:00:00Z'),
      release('3.6.8', '2026-10-20T10:00:00Z'),
      release('3.6.7', '2026-10-14T07:59:58Z'),
    ],
    localReleases: [
      release('3.6.8', '2026-10-20T10:00:00Z', { draft: true }),
      release('3.6.7', '2026-10-14T07:59:58Z'),
    ],
  })

  assert.deepEqual(result.missing, ['3.6.8'])
  assert.equal(result.stopAt, '3.6.7')
})

test('本仓库没有 Release 时列出全部历史并给出警告', () => {
  const result = findMissingReleases({
    upstreamReleases: [
      release('3.6.8', '2026-10-20T10:00:00Z'),
      release('3.6.7', '2026-10-14T07:59:58Z'),
    ],
    localReleases: [],
  })

  assert.deepEqual(result.missing, ['3.6.7', '3.6.8'])
  assert.equal(result.stopAt, null)
  assert.match(result.warning, /还没有 Release/)
})

test('本地版本都不在上游时间线时给出警告', () => {
  const result = findMissingReleases({
    upstreamReleases: [
      release('3.6.8', '2026-10-20T10:00:00Z'),
      release('3.6.7', '2026-10-14T07:59:58Z'),
    ],
    localReleases: [
      release('3.6.5', '2026-09-04T08:25:56Z'),
    ],
  })

  assert.deepEqual(result.missing, ['3.6.7', '3.6.8'])
  assert.equal(result.stopAt, null)
  assert.match(result.warning, /无法确定停止点/)
})
