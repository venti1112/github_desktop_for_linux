# GitHub Desktop for Linux

从上游 [desktop/desktop](https://github.com/desktop/desktop) 源码 + 本地补丁自动构建 GitHub Desktop 的 Linux 安装包。

支持格式：**deb / rpm / Arch Linux (pkg.tar.zst) / AppImage / tar.gz**，覆盖 **x64** 与 **arm64**；x64 额外附上打补丁后的完整源码包。

本仓库只含 Linux 支持相关的增量内容，不含完整源码：

```
.github/workflows/linux-check.yml   # 定时/手动检查缺口 → 派发构建
.github/workflows/linux-build.yml   # 构建单个指定版本（也支持手动触发）
patches/0001-linux-code.patch       # 对上游已有文件的修改
patches/package-extras.json         # package.json 的增量（依赖、scripts、resolutions）
patches/base.txt                    # 补丁基准的上游 tag（生成补丁时的“共同父提交”）
overlay/                            # 新增文件（打包脚本、图标、更新检查器等），原样复制进源码树
tools/                              # overlay / extras / 缺口计算与补丁刷新工具
README.md
LICENSE
```

## 工作原理

构建拆成“检查缺口”和“构建单个版本”两个 workflow。

### 检查缺口（`linux-check.yml`）

每天 UTC 06:00（北京时间 14:00）或手动运行：

1. 拉取本仓库与上游 `desktop/desktop` 的全部非 draft Release；
2. 按 `published_at` 从新到旧建立上游时间线（不能直接使用 API 默认的 `created_at` 顺序，否则 stable 可能排在 beta 后面）；
3. 从最新版本向前遍历，遇到本仓库已有的 Release 就停止，途中收集到的就是缺失版本；
4. 把缺失版本反转成“旧 → 新”，逐个触发 `linux-build.yml`；
5. 本仓库还没有任何 Release 时，会把全部历史版本列为缺口；建议先手动构建一个版本作为停止点。

检查 workflow 使用 `GITHUB_TOKEN` 派发构建（需要 `actions: write`），不需要额外的 PAT。多个构建任务通过 `queue: max` 按 FIFO 串行排队。

### 构建单个版本（`linux-build.yml`）

1. 接收一个明确的上游版本（检查 workflow 传入选定版本，也可以手动填写），目标已发布过则跳过；
2. 浅克隆上游对应 tag（含子模块）；
3. 应用 Linux 定制：
   - `tools/apply-overlay.mjs` 把 `overlay/` 中的新增文件复制进源码树（上游已存在同名文件时明确失败，不静默覆盖）；
   - `tools/apply-package-extras.mjs` 把 `patches/package-extras.json` 合并进 `package.json`（结构化合并，与上游版本无关）；
   - `patches/*.patch` 以 `git apply --3way` 重放，上游与补丁不重叠的改动会被自动吸收；真正冲突时任务失败，并在 Step Summary 中列出冲突文件和刷新步骤；
4. x64 额外把打补丁后的完整源码打包为 `GitHubDesktop-Linux-source-<version>.tar.gz`（排除 `.git`、`node_modules` 与构建产物；arm64 不重复上传）；
5. `yarn install && yarn build:prod && yarn package`，产出全部安装包；
6. 创建与上游同名的 Release（tag 与上游一致）。Release 里各文件的 SHA256 由 GitHub 自动计算并显示。

## 目录约定

| 要改的东西 | 放在哪里 |
| --- | --- |
| 新增文件（打包脚本、图标、更新检查器等） | `overlay/`，路径与上游源码树一致 |
| `package.json`（依赖、scripts、resolutions） | `patches/package-extras.json` |
| 修改上游已有文件 | `patches/0001-linux-code.patch` |

`patches/0001-linux-code.patch` 不会包含 `package.json` 和新增文件——`tools/regenerate-patch.mjs` 会自动排除它们，这样上游频繁变动的依赖表就不会再把补丁打挂。

## 更新检查

Linux 构建内置更新检查器，只查询本仓库的 Releases，不会自动下载或安装：

- 稳定版查询 `/releases/latest`；版本号含 `-beta` 时查询 `/releases`，按 semver 选择最新（包含 prerelease）；
- 后台：启动时及每 4 小时检查一次，同一进程内每小时最多请求一次并使用 ETag 条件请求；发现新版本时显示应用内横幅，不弹窗；
- 手动：About → Check for Updates 总是发起检查，并弹出原生对话框，按钮只打开对应 Release 页面；
- 横幅按版本记忆，同一版本被关闭后不会再次出现。

检查器实现位于 `overlay/app/src/main-process/linux-update-checker.ts`，版本选择逻辑在 `overlay/app/src/lib/linux-update.ts`。调试时可用 `DESKTOP_LINUX_UPDATE_REPO` 和 `DESKTOP_LINUX_UPDATE_CURRENT_VERSION` 覆盖仓库与当前版本。

## 手动触发

### 检查并补齐缺口

Actions → **Check and Dispatch Linux Builds** → Run workflow：

| 参数 | 说明 |
| --- | --- |
| `dry_run` | 只计算并列出待构建版本，不派发构建 |

该 workflow 也会每天自动运行。它只派发缺口版本，不会重复构建已有 Release。首次使用或想预览时，建议先勾选 `dry_run`。

### 手动构建单个版本

Actions → **Build Linux Packages** → Run workflow：

| 参数 | 说明 |
| --- | --- |
| `upstream_version` | 必填，上游版本（如 `3.6.8-beta2`），也可以带 `release-` 前缀 |
| `force_rebuild` | 该版本 Release 已存在时也重新构建 |
| `create_release` | 是否创建 Release（关闭则只上传 Actions artifacts） |
| `dry_run` | 仅检查上游 Release 和本地是否已发布，不构建 |

多个由检查 workflow 派发的构建会按 `queue: max` 的 FIFO 队列串行执行，避免并发构建互相干扰。

本地验证缺口计算：

```bash
node --test tools/find-missing-releases.test.mjs
```

## 刷新补丁

当自动构建在 **Apply Linux patches** 步骤失败时，说明上游修改了补丁涉及的代码，需要把补丁对齐到新版本：

```bash
# 一条命令完成：克隆新版本 → 复制 overlay → 合并 package.json → 3-way 重放补丁 → 重新生成补丁 + 更新基准
tools/refresh.sh 3.6.8
```

- 工作目录默认是 `refresh/`（已加入 `.gitignore`），也可用第二个参数指定。
- 如果提示冲突，进入该目录手动解决冲突，然后按脚本打印的命令重新生成补丁并更新 `patches/base.txt`。
- 刷新后可以顺手在同一个目录构建验证：`cd refresh && yarn install && yarn build:prod && yarn package`。

提交推送后重新运行 workflow 即可。

## 说明

- 构建产物未签名（deb/rpm 无 GPG 签名），Release 的 prerelease 标记与上游保持一致。
- License：MIT，与上游一致，见 [LICENSE](./LICENSE)。
