#!/usr/bin/env bash
#
# 把补丁刷新到新的上游版本。
#
# 流程: 克隆上游 tag → 复制 overlay → 合并 package.json extras →
#       3-way 应用现有补丁 → 重新生成 patches/0001-linux-code.patch → 更新 base.txt
#
# 用法: tools/refresh.sh <上游 tag（如 3.6.8 或 release-3.6.8）> [工作目录]
#
# 若补丁冲突，脚本会停下并打印冲突文件；手动解决后按提示重新生成即可。

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAG="${1:?用法: tools/refresh.sh <上游 tag（如 3.6.8 或 release-3.6.8）> [工作目录]}"
WORK_DIR="${2:-$REPO_ROOT/refresh}"
BASE="$(tr -d '[:space:]' < "$REPO_ROOT/patches/base.txt")"

# 允许省略 release- 前缀
case "$TAG" in
  release-*) ;;
  *) TAG="release-$TAG" ;;
esac

if [ -e "$WORK_DIR" ]; then
  echo "❌ 工作目录已存在: $WORK_DIR（请先删除，或作为第二个参数指定其它目录）" >&2
  exit 1
fi

echo "📋 当前补丁基准: $BASE"
echo "🎯 目标上游版本: $TAG"

git clone --depth 1 --branch "$TAG" --recurse-submodules --shallow-submodules \
  https://github.com/desktop/desktop.git "$WORK_DIR"

cd "$WORK_DIR"

if [ "$BASE" != "$TAG" ]; then
  echo "📥 拉取补丁基准 $BASE（供 3-way 使用）…"
  git fetch --depth 1 origin "refs/tags/${BASE}:refs/tags/patch-base"
fi

echo "📦 复制 overlay 文件 …"
node "$REPO_ROOT/tools/apply-overlay.mjs" "$REPO_ROOT/overlay" .

echo "📦 合并 package.json extras …"
node "$REPO_ROOT/tools/apply-package-extras.mjs" \
  "$REPO_ROOT/patches/package-extras.json" package.json

for patch in "$REPO_ROOT"/patches/*.patch; do
  echo "📦 应用 $(basename "$patch") …"
  if ! git apply --3way --whitespace=nowarn "$patch"; then
    echo ""
    echo "❌ 补丁冲突，请手动解决后重新生成："
    echo ""
    git diff --name-only --diff-filter=U | sed 's/^/   - /'
    echo ""
    echo "   # 手动解决冲突后："
    echo "   cd $WORK_DIR"
    echo "   git add -A"
    echo "   node $REPO_ROOT/tools/regenerate-patch.mjs $REPO_ROOT"
    echo "   echo $TAG > $REPO_ROOT/patches/base.txt"
    exit 1
  fi
done

git add -A
node "$REPO_ROOT/tools/regenerate-patch.mjs" "$REPO_ROOT"
echo "$TAG" > "$REPO_ROOT/patches/base.txt"

echo ""
echo "✅ 补丁已刷新: $BASE → $TAG"
echo "   构建验证: cd $WORK_DIR && yarn install && yarn build:prod && yarn package"
