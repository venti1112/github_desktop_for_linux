import * as path from 'path'
import * as cp from 'child_process'
import { getVersion } from '../app/package-info'
import { getDistPath, getDistRoot } from './dist-info'
import { mkdirSync, rmSync, copyFileSync } from 'fs'

function getArchitecture() {
  const arch = process.env.npm_config_arch || process.arch

  switch (arch) {
    case 'arm64':
      return 'arm64'
    case 'arm':
      return 'armv7l'
    default:
      return 'x86_64'
  }
}

const distRoot = getDistRoot()

export async function packageTarball(): Promise<string> {
  if (process.platform === 'win32') {
    return Promise.reject('Windows is not supported')
  }

  const arch = getArchitecture()
  const version = getVersion().replace(/[:\-]/g, '.')

  const buildDir = path.join(distRoot, `tarball-build-${arch}`)
  const pkgDir = path.join(buildDir, `GitHubDesktop-linux-${arch}-${version}`)

  // Clean and create directories
  rmSync(buildDir, { recursive: true, force: true })
  mkdirSync(pkgDir, { recursive: true })

  // Copy application files
  const cpResult = cp.spawnSync('cp', ['-r', `${getDistPath()}/.`, pkgDir], {
    stdio: 'inherit',
  })
  if (cpResult.status !== 0) {
    return Promise.reject(new Error(`Failed to copy application files to ${pkgDir}`))
  }

  // Copy LICENSE file
  copyFileSync(path.join(__dirname, '..', 'LICENSE'), path.join(pkgDir, 'LICENSE'))

  // Create the tar.gz archive
  const tarFileName = `GitHubDesktop-linux-${arch}-${version}.tar.gz`
  const tarPath = path.join(distRoot, tarFileName)
  const dirName = `GitHubDesktop-linux-${arch}-${version}`

  const tarCmd = `cd '${buildDir}' && tar -czf '${tarPath}' '${dirName}'`
  const tarResult = cp.spawnSync('sh', ['-c', tarCmd], { stdio: 'inherit' })

  if (tarResult.error || tarResult.status !== 0) {
    return Promise.reject(new Error(`Failed to create tar.gz archive: ${tarResult.error?.message || `exit code ${tarResult.status}`}`))
  }

  return Promise.resolve(tarPath)
}