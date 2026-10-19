# GitHub Desktop for Linux

从上游 [desktop/desktop](https://github.com/desktop/desktop) 源码 + 本地补丁自动构建 GitHub Desktop 的 Linux 安装包。

支持格式：**deb / rpm / Arch Linux (pkg.tar.zst) / AppImage / tar.gz**，覆盖 **x64** 与 **arm64**。

本仓库只含 Linux 支持补丁，不含完整源码：

```
.github/workflows/linux-build.yml   # 检测上游 → 下载源码 → 打补丁 → 构建 → 发布
patches/0001-linux-code.patch       # 代码类定制（打包脚本、Linux 修复）
patches/0002-linux-assets.patch     # 二进制资源（应用图标 6 张 PNG）
patches/base.txt                    # 补丁基准的上游 tag（生成补丁时的“共同父提交”）
README.md
LICENSE
```

## 工作原理

工作流每天 UTC 06:00（北京时间 14:00）检查上游新 Release：

1. 确定目标版本（上游最新 Release，或手动指定），目标已发布过则跳过；
2. 浅克隆上游对应 tag（含子模块）；
3. 应用 `patches/*.patch`（代码补丁 + 资源补丁）。上游与补丁不重叠的改动会被 3-way 自动吸收；真正冲突时任务失败，并在 Step Summary 中列出冲突文件和刷新步骤；
4. `yarn install && yarn build:prod && yarn package`，产出全部安装包；
5. 创建与上游同名的 Release（tag 与上游一致），并附上 `SHA256SUMS.txt`。

## 手动触发

Actions → **Build Linux Packages** → Run workflow：

| 参数 | 说明 |
| --- | --- |
| `upstream_version` | 指定上游版本（如 `3.6.8-beta2`），留空自动检测最新 |
| `force_rebuild` | 该版本 Release 已存在时也重新构建 |
| `create_release` | 是否创建 Release（关闭则只上传 Actions artifacts） |
| `dry_run` | 仅检测上游版本，不构建 |

## 刷新补丁

当自动构建在 **Apply Linux patches** 步骤失败时，说明上游修改了补丁涉及的代码，需要人工把补丁对齐到新版本：

```bash
# 1. 以新版本为基准克隆上游（这正是补丁的“共同父提交”位置）
git clone --depth 1 --branch <新 tag> --recurse-submodules --shallow-submodules \
  https://github.com/desktop/desktop.git refresh
cd refresh

# 2. 拉取补丁当前基准（--3way 需要它的 blob），按顺序应用现有补丁
git fetch --depth 1 origin \
  refs/tags/<patches/base.txt 里的旧 tag>:refs/tags/patch-base
for p in /path/to/repo/patches/*.patch; do git apply --3way "$p"; done

# 3. 若提示冲突：手动编辑带冲突标记的文件解决冲突

# 4. 分别重新生成两个补丁（代码 / 资源分开，便于 review）并更新基准
git add -A
git diff --binary --cached HEAD -- . ':(exclude)app/static/linux/logos' \
  > /path/to/repo/patches/0001-linux-code.patch
git diff --binary --cached HEAD -- app/static/linux/logos \
  > /path/to/repo/patches/0002-linux-assets.patch
echo "<新 tag>" > /path/to/repo/patches/base.txt

# 5. 提交推送后重新运行 workflow
```

## 说明

- 构建产物未签名（deb/rpm 无 GPG 签名），Release 的 prerelease 标记与上游保持一致。
- License：MIT，与上游一致，见 [LICENSE](./LICENSE)。
