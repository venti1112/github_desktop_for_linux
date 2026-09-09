# GitHub Desktop for Linux（非官方）

[English](README.md) | [中文](README_ZH-CN.md)

> **⚠️ 重要提示**  
> 本分支由社区维护，**并非 GitHub 官方发布的 Linux 客户端**。所有 Linux 相关的打包、适配和测试工作均为社区贡献，使用前请知悉。

[GitHub Desktop](https://desktop.github.com/) 是一个基于 [Electron](https://www.electronjs.org/) 的开源 GitHub 桌面客户端，使用 [TypeScript](https://www.typescriptlang.org) 编写，采用 [React](https://reactjs.org/) 构建界面。

**本分支为 GitHub Desktop 添加了 Linux 支持（非官方）**，包括 AppImage、Debian/Ubuntu (.deb)、Fedora/RHEL (.rpm) 和 Arch Linux (.pkg.tar.zst) 格式的安装包，同时支持 x86_64 和 arm64 架构。

<picture>
  <source
    srcset="https://user-images.githubusercontent.com/634063/202742848-63fa1488-6254-49b5-af7c-96a6b50ea8af.png"
    media="(prefers-color-scheme: dark)"
  />
  <img
    width="1072"
    src="https://user-images.githubusercontent.com/634063/202742985-bb3b3b94-8aca-404a-8d8a-fd6a6f030672.png"
    alt="GitHub Desktop 应用截图"
  />
</picture>

## 下载

### 官方版本

下载对应操作系统的官方安装包：

 - [macOS](https://central.github.com/deployments/desktop/desktop/latest/darwin)
 - [macOS (Apple silicon)](https://central.github.com/deployments/desktop/desktop/latest/darwin-arm64)
 - [Windows](https://central.github.com/deployments/desktop/desktop/latest/win32)
 - [Windows 全局安装](https://central.github.com/deployments/desktop/desktop/latest/win32?format=msi)

### Linux（本分支）

| 格式 | x86_64 | arm64 |
|------|--------|-------|
| AppImage | ✅ | ✅ |
| Debian/Ubuntu (.deb) | ✅ | ✅ |
| Fedora/RHEL (.rpm) | ✅ | ✅ |
| Arch Linux (.pkg.tar.zst) | ✅ | ✅ |

前往 [Releases](https://github.com/venti1112/github_desktop_for_linux/releases) 页面，根据您的需要下载对应架构对应格式的构建。

## 安装

### AppImage（通用格式）

AppImage 可在大多数 Linux 发行版上直接运行，无需安装。

```bash
# 下载 AppImage 后添加执行权限
chmod +x GitHubDesktop-linux-x86_64-*.AppImage

# 直接运行
./GitHubDesktop-linux-x86_64-*.AppImage
```

### Debian / Ubuntu

```bash
# x86_64
sudo apt install ./GitHubDesktop-linux-amd64-*.deb

# arm64
sudo apt install ./GitHubDesktop-linux-arm64-*.deb
```

### Fedora / RHEL

```bash
# x86_64
sudo rpm -i GitHubDesktop-linux-x86_64-*.rpm

# arm64
sudo rpm -i GitHubDesktop-linux-aarch64-*.rpm
```

### Arch Linux

```bash
# x86_64
sudo pacman -U GitHubDesktop-linux-x86_64-*.pkg.tar.zst

# arm64
sudo pacman -U GitHubDesktop-linux-aarch64-*.pkg.tar.zst
```

## 从源码构建

### 前置要求

- [Node.js](https://nodejs.org/) >= 24.x
- [Yarn](https://yarnpkg.com/) 1.x
- Linux 构建工具：
  - Debian/Ubuntu：`sudo apt-get install dpkg-dev fakeroot`
  - Fedora/RHEL：`sudo dnf install rpm-build`
  - Arch Linux：`sudo pacman -S base-devel zstd`

### 构建步骤

```bash
# 克隆仓库
git clone https://github.com/venti1112/github_desktop_for_linux.git
cd github_desktop_for_linux

# 安装依赖
yarn install

# 构建生产版本
yarn build:prod

# 打包所有可用格式
yarn package
```

构建完成的安装包将位于 `dist/` 目录。

## 与原版的区别

本分支添加了以下 Linux 相关改动：

- **打包脚本**：支持 AppImage、deb、rpm 和 Arch Linux 格式
- **OAuth 回调修复**：修复 Linux 上的协议处理（second-instance）
- **禁用自动更新**：Linux 上没有官方更新服务器支持
- **桌面集成**：包含 `.desktop` 文件、图标和 MIME 类型处理
- **CI/CD 工作流**：GitHub Actions 自动化构建
- **非官方声明**：本分支为社区维护的非官方版本，与 GitHub 官方发布的 macOS/Windows 版本无关。所有 Linux 相关的改动均由社区贡献，未经过 GitHub 官方测试或认可，使用时请知悉。

## 已知限制

- Linux 上不支持自动更新。
- 本分支为非官方社区版本，可能缺乏官方版本的质量保证、持续更新和稳定性保障，请自行评估使用风险。

## 贡献

如果你想为这个 Linux 移植版本贡献代码，请参考原版 [CONTRIBUTING.md](./.github/CONTRIBUTING.md) 了解一般准则。

## 许可证

**[MIT](LICENSE)**

MIT 许可证不包含 GitHub 的商标，包括徽标设计。GitHub 保留所有 GitHub 商标的所有商标和版权。GitHub 的徽标包括，在以下文件夹中文件标题包含 "logo" 的风格化 Invertocat 设计：[logos](app/static/logos)。

GitHub® 及其风格化版本和 Invertocat 标志是 GitHub 的商标或注册商标。使用 GitHub 徽标时，请务必遵守 GitHub 的 [徽标使用指南](https://github.com/logos)。
