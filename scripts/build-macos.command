#!/bin/bash
cd "$(dirname "$0")/.." || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "需要先安装 Node.js 才能执行打包脚本：https://nodejs.org/"
  read -n 1 -s -r -p "按任意键退出…"
  exit 1
fi

if ! node scripts/build-sea.js --platform mac; then
  echo
  read -n 1 -s -r -p "打包失败，按任意键退出…"
  exit 1
fi

echo
read -n 1 -s -r -p "打包完成，按任意键退出…"
