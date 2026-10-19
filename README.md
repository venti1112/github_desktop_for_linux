# GitHub Desktop for Linux

从上游 [desktop/desktop](https://github.com/desktop/desktop) 源码 + 本地补丁自动构建 GitHub Desktop 的 Linux 安装包。

支持格式：**deb / rpm / Arch Linux (pkg.tar.zst) / AppImage / tar.gz**，覆盖 **x64** 与 **arm64**。

本仓库只含 Linux 支持相关的增量内容，不含完整源码：

```
.github/workflows/linux-build.yml   # 检测上游 → 下载源码 → 应用定制 → 构建 → 发布
patches/0001-linux-code.patch       # 对上游已有文件的修改
patches/package-extras.json         # package.json 的增量（依赖、scripts、resolutions）
patches/base.txt                    # 补丁基准的上游 tag（生成补丁时的“共同父提交”）
overlay/                            # 新增文件（打包脚本、图标），原样复制进源码树
tools/                              # overlay / extras 的应用与补丁刷新工具
README.md
LICENSE
```

## 工作原理

工作流每天 UTC 06:00（北京时间 14:00）检查上游新 Release：

1. 确定目标版本（上游最新 Release，或手动指定），目标已发布过则跳过；
2. 浅克隆上游对应 tag（含子模块）；
3. 应用 Linux 定制：
   - `tools/apply-overlay.mjs` 把 `overlay/` 中的新增文件复制进源码树（上游已存在同名文件时明确失败，不静默覆盖）；
   - `tools/apply-package-extras.mjs` 把 `patches/package-extras.json` 合并进 `package.json`（结构化合并，与上游版本无关）；
   - `patches/*.patch` 以 `git apply --3way` 重放，上游与补丁不重叠的改动会被自动吸收；真正冲突时任务失败，并在 Step Summary 中列出冲突文件和刷新步骤；
4. `yarn install && yarn build:prod && yarn package`，产出全部安装包；
5. 创建与上游同名的 Release（tag 与上游一致），并附上 `SHA256SUMS.txt`。

## 目录约定

| 要改的东西 | 放在哪里 |
| --- | --- |
| 新增文件（打包脚本、图标等） | `overlay/`，路径与上游源码树一致 |
| `package.json`（依赖、scripts、resolutions） | `patches/package-extras.json` |
| 修改上游已有文件 | `patches/0001-linux-code.patch` |

`patches/0001-linux-code.patch` 不会包含 `package.json` 和新增文件——`tools/regenerate-patch.mjs` 会自动排除它们，这样上游频繁变动的依赖表就不会再把补丁打挂。

## 手动触发

Actions → **Build Linux Packages** → Run workflow：

| 参数 | 说明 |
| --- | --- |
| `upstream_version` | 指定上游版本（如 `3.6.8-beta2`），留空自动检测最新 |
| `force_rebuild` | 该版本 Release 已存在时也重新构建 |
| `create_release` | 是否创建 Release（关闭则只上传 Actions artifacts） |
| `dry_run` | 仅检测上游版本，不构建 |

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
