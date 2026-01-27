#!/bin/bash
# 快速重新打包并测试脚本

set -e

echo "🚀 EchoTrace 快速重新打包并测试"
echo "======================================"
echo ""

# 进入 desktop 目录
cd "$(dirname "$0")/apps/desktop"

# 步骤 1: 检查环境
echo "📌 步骤 1/3: 检查 Python 环境"
./check-python-env.sh
echo ""

# 步骤 2: 重新打包
echo "📌 步骤 2/3: 重新打包应用"
./rebuild-package.sh
echo ""

# 步骤 3: 启动测试
echo "📌 步骤 3/3: 启动应用进行测试"
echo ""
echo "✅ 打包完成！正在启动应用..."
echo ""
echo "⚠️  请注意观察："
echo "   1. 应用是否显示'正在启动服务...'"
echo "   2. 约 2-5 秒后是否进入模型下载或主界面"
echo "   3. 点击下载模型按钮是否正常工作"
echo ""

# 启动应用
open src-tauri/target/release/bundle/macos/EchoTrace.app

echo "🎉 应用已启动！"
echo ""
echo "💡 提示："
echo "   - 查看日志: tail -f ~/Library/Logs/com.echotrace.desktop/core.log"
echo "   - 系统托盘可手动控制服务"
echo ""
