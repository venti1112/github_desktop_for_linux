import { gt, valid } from 'semver'

/** The subset of the GitHub release API payload used by the update checker. */
export interface IGitHubRelease {
  readonly tag_name: string
  readonly html_url: string
  readonly published_at: string | null
  readonly draft: boolean
  readonly prerelease: boolean
}

/** Information about a newer GitHub Desktop release. */
export interface ILinuxUpdateInfo {
  readonly version: string
  readonly releaseUrl: string
  readonly publishedAt: string
}

/** The result of checking the release repository for a newer version. */
export interface ILinuxUpdateResult {
  readonly update: ILinuxUpdateInfo | null
  readonly error: string | null
}

/**
 * Extract a semver version from a GitHub release tag.
 *
 * Upstream tags releases as `release-3.6.7`; accept bare versions as well so
 * this keeps working if the tag format ever changes.
 */
export function getReleaseVersion(tagName: string): string | null {
  const version = tagName.startsWith('release-')
    ? tagName.slice('release-'.length)
    : tagName

  return valid(version)
}

/** Whether the given version is a beta build. */
export function isBetaVersion(version: string): boolean {
  return version.includes('-beta')
}

/**
 * Find the newest release which is newer than the current version.
 *
 * Beta builds consider both stable releases and prereleases. Stable builds
 * only consider stable releases, even when checking the full release list.
 */
export function findLatestRelease(
  releases: ReadonlyArray<IGitHubRelease>,
  currentVersion: string,
  includePrerelease: boolean
): ILinuxUpdateInfo | null {
  const current = valid(currentVersion)

  if (current === null) {
    return null
  }

  let latest: { version: string; release: IGitHubRelease } | null = null

  for (const release of releases) {
    if (release.draft) {
      continue
    }

    if (!includePrerelease && release.prerelease) {
      continue
    }

    const version = getReleaseVersion(release.tag_name)

    if (version === null) {
      continue
    }

    if (latest === null || gt(version, latest.version)) {
      latest = { version, release }
    }
  }

  if (latest === null || !gt(latest.version, current)) {
    return null
  }

  return {
    version: latest.version,
    releaseUrl: latest.release.html_url,
    publishedAt: latest.release.published_at ?? '',
  }
}
