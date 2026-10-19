import { app, dialog, net, shell } from 'electron'
import {
  findLatestRelease,
  getReleaseVersion,
  isBetaVersion,
} from '../lib/linux-update'
import type { IGitHubRelease, ILinuxUpdateResult } from '../lib/linux-update'
import { log as writeLog } from './log'

/** Repository containing the Linux builds. */
const DefaultRepository = 'venti1112/github_desktop_for_linux'

/** Minimum time between two automatic checks, in milliseconds. */
const BackgroundCheckInterval = 60 * 60 * 1000

/** How long to wait for the GitHub API before giving up. */
const RequestTimeout = 15 * 1000

let lastCheckAt = 0
let lastResult: ILinuxUpdateResult | null = null
let etag: string | null = null
let etagUrl: string | null = null

/** The repository to check, allowing tests to point at another repository. */
function getRepository(): string | null {
  const repository = process.env.DESKTOP_LINUX_UPDATE_REPO ?? DefaultRepository

  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)
    ? repository
    : null
}

/** The version currently running, allowing tests to simulate older builds. */
function getCurrentVersion(): string {
  return process.env.DESKTOP_LINUX_UPDATE_CURRENT_VERSION ?? app.getVersion()
}

/**
 * Check the Linux release repository for a newer version.
 *
 * Background checks are throttled and never show UI. Interactive checks always
 * hit the network (subject to GitHub's ETag support) and show a native dialog
 * with the result.
 */
export async function checkForLinuxUpdate(
  interactive: boolean
): Promise<ILinuxUpdateResult> {
  if (
    !interactive &&
    lastResult !== null &&
    Date.now() - lastCheckAt < BackgroundCheckInterval
  ) {
    return lastResult
  }

  const result = await performCheck()

  lastCheckAt = Date.now()
  lastResult = result

  if (result.error !== null) {
    await writeLog('warn', `Linux update check failed: ${result.error}`)
  }

  if (interactive) {
    await showResultDialog(result)
  }

  return result
}

async function performCheck(): Promise<ILinuxUpdateResult> {
  const repository = getRepository()

  if (repository === null) {
    return {
      update: null,
      error: `Invalid update repository: ${process.env.DESKTOP_LINUX_UPDATE_REPO}`,
    }
  }

  const currentVersion = getCurrentVersion()

  if (getReleaseVersion(currentVersion) === null) {
    return {
      update: null,
      error: `Unable to parse current version: ${currentVersion}`,
    }
  }

  const isBeta = isBetaVersion(currentVersion)
  const url = isBeta
    ? `https://api.github.com/repos/${repository}/releases?per_page=100`
    : `https://api.github.com/repos/${repository}/releases/latest`

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': `GitHubDesktop-Linux/${currentVersion}`,
  }

  if (etag !== null && etagUrl === url) {
    headers['If-None-Match'] = etag
  }

  try {
    const response = await net.fetch(url, {
      headers,
      signal: AbortSignal.timeout(RequestTimeout),
    })

    if (response.status === 304 && etagUrl === url) {
      return (
        lastResult ?? {
          update: null,
          error: 'GitHub API returned 304 without a cached result',
        }
      )
    }

    if (response.status === 404 && !isBeta) {
      // There is no stable release in the repository yet.
      return { update: null, error: null }
    }

    if (!response.ok) {
      return {
        update: null,
        error: await getErrorDetail(response),
      }
    }

    etag = response.headers.get('etag')
    etagUrl = url

    const json: unknown = await response.json()
    const releases: ReadonlyArray<IGitHubRelease> = Array.isArray(json)
      ? (json as ReadonlyArray<IGitHubRelease>)
      : [json as IGitHubRelease]

    const update = findLatestRelease(releases, currentVersion, isBeta)

    if (update !== null && !isGitHubReleaseUrl(update.releaseUrl)) {
      return {
        update: null,
        error: `Unexpected release URL: ${update.releaseUrl}`,
      }
    }

    return { update, error: null }
  } catch (e) {
    return {
      update: null,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

async function getErrorDetail(response: Response): Promise<string> {
  const prefix = `GitHub API returned ${response.status} ${response.statusText}`

  try {
    const body: unknown = await response.json()

    if (
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string'
    ) {
      return `${prefix}: ${body.message}`
    }
  } catch {
    // Ignore malformed error bodies and use the status line instead.
  }

  return prefix
}

function isGitHubReleaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && parsed.hostname === 'github.com'
  } catch {
    return false
  }
}

async function showResultDialog(result: ILinuxUpdateResult) {
  const currentVersion = getCurrentVersion()

  if (result.error !== null) {
    await dialog.showMessageBox({
      type: 'error',
      message: 'Unable to check for updates',
      detail: result.error,
      buttons: ['OK'],
      defaultId: 0,
      noLink: true,
    })
    return
  }

  if (result.update === null) {
    await dialog.showMessageBox({
      type: 'info',
      message: "You're up to date",
      detail: `GitHub Desktop ${currentVersion} is the latest version.`,
      buttons: ['OK'],
      defaultId: 0,
      noLink: true,
    })
    return
  }

  const { response } = await dialog.showMessageBox({
    type: 'info',
    message: `GitHub Desktop ${result.update.version} is available`,
    detail: `You're running ${currentVersion}. Open the release page to download the package for your distribution.`,
    buttons: ['Open release page', 'Later'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  })

  if (response === 0) {
    await openReleasePage(result.update.releaseUrl)
  }
}

async function openReleasePage(releaseUrl: string) {
  try {
    await shell.openExternal(releaseUrl)
  } catch (e) {
    await writeLog(
      'warn',
      `Unable to open release page: ${
        e instanceof Error ? e.message : String(e)
      }`
    )
  }
}
