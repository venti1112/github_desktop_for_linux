# GitHub Desktop for Linux (unofficial)

[English](README.md) | [简体中文](README_ZH-CN.md)

> **⚠️ Important**  
> This branch is community-maintained and **is not an official GitHub release for Linux**. All Linux packaging, adaptation, and testing are contributed by the community. Use at your own discretion.

[GitHub Desktop](https://desktop.github.com/) is an open-source [Electron](https://www.electronjs.org/)-based
GitHub app. It is written in [TypeScript](https://www.typescriptlang.org) and
uses [React](https://reactjs.org/).

**This branch adds Linux support (unofficial) to GitHub Desktop**, including Debian/Ubuntu (.deb), Fedora/RHEL (.rpm), Arch Linux (.pkg.tar.zst) , AppImage and tar.gz packages for both x86_64 and arm64 architectures.

<picture>
  <source
    srcset="https://user-images.githubusercontent.com/634063/202742848-63fa1488-6254-49b5-af7c-96a6b50ea8af.png"
    media="(prefers-color-scheme: dark)"
  />
  <img
    width="1072"
    src="https://user-images.githubusercontent.com/634063/202742985-bb3b3b94-8aca-404a-8d8a-fd6a6f030672.png"
    alt="A screenshot of the GitHub Desktop application"
  />
</picture>

## Downloads

Go to the [Releases](https://github.com/venti1112/github_desktop_for_linux/releases) page and download the build for your required architecture and format.

## Installation

### Debian / Ubuntu

```bash
sudo apt install ./GitHubDesktop-linux-*.deb
```

### Fedora / RHEL

```bash
sudo dnf install ./GitHubDesktop-linux-*.rpm
```

### Arch Linux

```bash
sudo pacman -U ./GitHubDesktop-linux-*.pkg.tar.zst
```

### AppImage

```bash
chmod +x GitHubDesktop-linux-*.AppImage
./GitHubDesktop-linux-*.AppImage
```

### tar.gz

```bash
tar -xzf GitHubDesktop-linux-*.tar.gz
cd GitHubDesktop-linux-*
chmod +x desktop
./desktop
```

## Building from Source

### Prerequisites

- [Node.js](https://nodejs.org/) >= 24.x
- [Yarn](https://yarnpkg.com/) 1.x
- Linux build tools:
  - Debian/Ubuntu: `sudo apt-get install dpkg-dev fakeroot`
  - Fedora/RHEL: `sudo dnf install rpm-build`
  - Arch Linux: `sudo pacman -S base-devel zstd`

### Build Steps

```bash
# Clone the repository
git clone https://github.com/venti1112/github_desktop_for_linux.git
cd github_desktop_for_linux

# Install dependencies
yarn install

# Build the production app
yarn build:prod

# Package for all available formats
yarn package
```

The built packages will be in the `dist/` directory.

## What's Different from the Original

This branch adds the following Linux-specific changes:

- **Packaging scripts** for .deb, .rpm, .pkg.tar.zst, .AppImage, .tar.gz
- **Linux OAuth callback fix** for protocol handling in second-instance
- **Desktop notifications** are now supported on Linux
- **Auto-update disabled** on Linux (no official update server supports Linux)
- **Desktop integration** with `.desktop` file, icons, and MIME type handlers
- **CI/CD workflow** for automated builds on GitHub Actions
- **Unofficial disclaimer**: This branch is a community-maintained unofficial version and is not affiliated with GitHub's official macOS/Windows releases. All Linux-specific changes are contributed by the community and have not been tested or endorsed by GitHub. Please be aware of this when using it.

## Known Limitations

- Auto-update is not available on Linux.
- This is an unofficial community fork, which may lack the quality assurance, regular updates, and stability guarantees of the official release. Use at your own risk.

## Contributing

If you'd like to contribute to this Linux port, please see the original [CONTRIBUTING.md](./.github/CONTRIBUTING.md) for general guidelines.

## License

**[MIT](LICENSE)**

The MIT license grant is not for GitHub's trademarks, which include the logo
designs. GitHub reserves all trademark and copyright rights in and to all
GitHub trademarks. GitHub's logos include, for instance, the stylized
Invertocat designs that include "logo" in the file title in the following
folder: [logos](app/static/logos).

GitHub® and its stylized versions and the Invertocat mark are GitHub's
Trademarks or registered Trademarks. When using GitHub's logos, be sure to
follow the GitHub [logo guidelines](https://github.com/logos).
