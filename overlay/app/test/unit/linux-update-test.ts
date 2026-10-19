import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  findLatestRelease,
  getReleaseVersion,
  isBetaVersion,
} from '../../src/lib/linux-update'
import type { IGitHubRelease } from '../../src/lib/linux-update'

function release(
  tagName: string,
  overrides: Partial<IGitHubRelease> = {}
): IGitHubRelease {
  return {
    tag_name: tagName,
    html_url: `https://github.com/example/repo/releases/tag/${tagName}`,
    published_at: '2026-10-19T00:00:00Z',
    draft: false,
    prerelease: tagName.includes('-beta'),
    ...overrides,
  }
}

describe('linux update release selection', () => {
  it('parses release tags', () => {
    assert.equal(getReleaseVersion('release-3.6.7'), '3.6.7')
    assert.equal(getReleaseVersion('3.6.7'), '3.6.7')
    assert.equal(getReleaseVersion('release-not-a-version'), null)
  })

  it('detects beta versions', () => {
    assert.equal(isBetaVersion('3.6.8-beta2'), true)
    assert.equal(isBetaVersion('3.6.7'), false)
  })

  it('returns a newer stable release', () => {
    const update = findLatestRelease([release('release-3.6.7')], '3.6.6', false)

    assert.deepEqual(update, {
      version: '3.6.7',
      releaseUrl: 'https://github.com/example/repo/releases/tag/release-3.6.7',
      publishedAt: '2026-10-19T00:00:00Z',
    })
  })

  it('returns null when the current version is up to date', () => {
    assert.equal(
      findLatestRelease([release('release-3.6.7')], '3.6.7', false),
      null
    )
  })

  it('ignores prereleases for stable builds', () => {
    assert.equal(
      findLatestRelease(
        [release('release-3.6.8-beta2'), release('release-3.6.7')],
        '3.6.7',
        false
      ),
      null
    )
  })

  it('selects the highest prerelease for beta builds', () => {
    const update = findLatestRelease(
      [
        release('release-3.6.8-beta2'),
        release('release-3.6.7'),
        release('release-3.6.8-beta1'),
      ],
      '3.6.8-beta1',
      true
    )

    assert.equal(update?.version, '3.6.8-beta2')
  })

  it('ignores drafts and invalid tags', () => {
    assert.equal(
      findLatestRelease(
        [release('release-3.6.9', { draft: true }), release('release-nightly')],
        '3.6.7',
        true
      ),
      null
    )
  })

  it('returns null for invalid current versions', () => {
    assert.equal(
      findLatestRelease([release('release-3.6.7')], 'not-a-version', false),
      null
    )
  })
})
