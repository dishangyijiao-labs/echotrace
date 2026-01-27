#!/bin/bash
# EchoTrace 重新打包脚本
# 运行方式: cd apps/desktop && ./rebuild-package.sh

set -e  # 遇到错误立即退出

echo "======================================"
echo "EchoTrace 重新打包脚本"
echo "======================================"
echo ""

# 检查 Python 环境
echo "📌 预检查: Python 环境"
if [ ! -d "../core/.venv" ]; then
    echo "   ⚠️  警告: Core Python 虚拟环境不存在"
    echo "   打包后的应用需要 Python 环境才能运行"
    echo ""
    echo "   建议先运行: ./check-python-env.sh"
    echo ""
    read -p "   是否继续打包? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "   ✅ Python 环境已配置"
fi
echo ""

# 检查 Node.js 版本
echo "📌 步骤 1/5: 检查 Node.js 版本"
NODE_VERSION=$(node --version)
echo "   当前版本: $NODE_VERSION"

# 检查版本是否满足要求 (需要 v20.19+ 或 v22.12+)
NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
    echo "   ❌ 错误: Node.js 版本过低，需要 v20.19+ 或 v22.12+"
    echo "   请运行: brew upgrade node"
    exit 1
fi
echo "   ✅ Node.js 版本符合要求"
echo ""

# 清理旧的构建产物
echo "📌 步骤 2/5: 清理旧的构建产物"
echo "   清理 node_modules..."
rm -rf node_modules
echo "   清理 package-lock.json..."
rm -rf package-lock.json
echo "   清理 dist..."
rm -rf dist
echo "   清理旧的 Tauri bundle..."
rm -rf src-tauri/target/release/bundle
echo "   ✅ 清理完成"
echo ""

# 重新安装依赖
echo "📌 步骤 3/5: 安装依赖"
echo "   运行 npm install（使用淘宝镜像加速）..."
npm install --registry=https://registry.npmmirror.com
echo "   ✅ 依赖安装完成"
echo ""

# 构建前端
echo "📌 步骤 4/5: 构建前端"
echo "   运行 npm run build..."
npm run build
echo "   ✅ 前端构建完成"
echo ""

# 打包 Tauri 应用
echo "📌 步骤 5/5: 打包 Tauri 应用"
echo "   运行 npm run tauri build..."
echo "   ⏳ 这可能需要几分钟时间..."
npm run tauri build
echo "   ✅ Tauri 应用打包完成"
echo ""

# 显示打包结果
echo "======================================"
echo "🎉 打包成功！"
echo "======================================"
echo ""
echo "📦 打包产物位置:"
echo ""

if [ -f "src-tauri/target/release/bundle/dmg/EchoTrace_0.1.0_aarch64.dmg" ]; then
    DMG_SIZE=$(ls -lh src-tauri/target/release/bundle/dmg/EchoTrace_0.1.0_aarch64.dmg | awk '{print $5}')
    echo "   ✅ DMG 安装包:"
    echo "      src-tauri/target/release/bundle/dmg/EchoTrace_0.1.0_aarch64.dmg"
    echo "      大小: $DMG_SIZE"
    echo ""
fi

if [ -d "src-tauri/target/release/bundle/macos/EchoTrace.app" ]; then
    echo "   ✅ macOS 应用:"
    echo "      src-tauri/target/release/bundle/macos/EchoTrace.app"
    echo ""
fi

echo "======================================"
echo "🧪 测试应用:"
echo "======================================"
echo ""
echo "方法 1: 直接运行 .app"
echo "   open src-tauri/target/release/bundle/macos/EchoTrace.app"
echo ""
echo "方法 2: 安装 DMG"
echo "   open src-tauri/target/release/bundle/dmg/EchoTrace_0.1.0_aarch64.dmg"
echo ""
echo "⚠️  测试前请确保 Core 服务正在运行:"
echo "   cd ../core && python app.py"
echo ""
