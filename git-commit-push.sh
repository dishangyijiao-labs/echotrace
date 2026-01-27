#!/bin/bash
# Commit and push changes to remote

set -e

cd "$(dirname "$0")"

echo "======================================"
echo "Git Commit and Push"
echo "======================================"
echo ""

# Check git status
echo "📌 Current Git Status:"
git status --short
echo ""

# Show current branch
BRANCH=$(git branch --show-current)
echo "📌 Current Branch: $BRANCH"
echo ""

# Check if there are changes
if [ -z "$(git status --porcelain)" ]; then
    echo "✅ No changes to commit"
    exit 0
fi

# Show what will be committed
echo "📌 Files to be committed:"
git status --short
echo ""

# Add all changes (excluding ignored files)
echo "📌 Adding changes..."
git add -A
echo ""

# Create commit message
echo "======================================"
echo "Creating commit..."
echo "======================================"
echo ""

COMMIT_MSG="feat: complete auto-start services and documentation cleanup

Major Changes:
- ✅ Auto-start Core API and Worker on app launch
- ✅ Auto-cleanup services on app exit
- ✅ Smart service wait logic in frontend
- ✅ Fixed Rust lifetime issues
- ✅ Documentation cleanup (7 files removed, all docs in English)
- ✅ Python 3.12 environment setup scripts
- ✅ China mirror support for faster pip installs
- ✅ Fixed Apple Silicon compatibility issues

Technical Updates:
- Updated Tauri lib.rs with auto-start logic
- Updated React App.jsx with service wait logic
- Simplified all documentation to English
- Created installation scripts for Python dependencies
- Fixed onnxruntime/faster-whisper compatibility

New Files:
- setup-python-env.sh
- install-with-python312.sh
- install-fast-china.sh
- APPLE_SILICON_SETUP.md
- Updated README.md, ARCHITECTURE.md, PRIVACY.md

Removed Files:
- IMPLEMENTATION_SUMMARY.md
- RAG_INTEGRATION_SUMMARY.md
- AUTO_START_GUIDE.md
- BEFORE_AFTER_COMPARISON.md
- CONTENT_CREATOR_EDITION.md
- MODEL_SETUP.md
- RAG_AGENT_GUIDE.md"

echo "$COMMIT_MSG"
echo ""

# Commit
git commit -m "$COMMIT_MSG"
echo ""
echo "✅ Changes committed!"
echo ""

# Push to remote
echo "📌 Pushing to remote: origin/$BRANCH"
read -p "Continue with push? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git push origin $BRANCH
    echo ""
    echo "======================================"
    echo "🎉 Successfully pushed to remote!"
    echo "======================================"
else
    echo ""
    echo "⚠️  Push cancelled. You can push later with:"
    echo "   git push origin $BRANCH"
fi

echo ""
