#!/bin/bash
# Script to copy UI components from profit-accelerator and apply modifications
# Run this on your local machine

set -e

SOURCE_REPO="/Users/tadii/profit-accelerator"
TARGET_DIR="/Users/tadii/dashboard_complete_package/frontend"

if [ ! -d "$SOURCE_REPO" ]; then
    echo "Error: Source repo not found at $SOURCE_REPO"
    exit 1
fi

echo "Copying UI components from $SOURCE_REPO to $TARGET_DIR..."

# Copy dashboard components
echo "Copying dashboard components..."
cp -r "$SOURCE_REPO/src/components/dashboard"/* "$TARGET_DIR/src/components/dashboard/" 2>/dev/null || true

# Copy UI components
echo "Copying UI components..."
cp -r "$SOURCE_REPO/src/components/ui"/* "$TARGET_DIR/src/components/ui/" 2>/dev/null || true

# Copy pages
echo "Copying pages..."
cp -r "$SOURCE_REPO/src/pages"/* "$TARGET_DIR/src/pages/" 2>/dev/null || true

# Copy hooks
echo "Copying hooks..."
cp -r "$SOURCE_REPO/src/hooks"/* "$TARGET_DIR/src/hooks/" 2>/dev/null || true

# Copy lib
echo "Copying lib files..."
cp -r "$SOURCE_REPO/src/lib"/* "$TARGET_DIR/src/lib/" 2>/dev/null || true

# Copy store
echo "Copying store..."
cp -r "$SOURCE_REPO/src/store"/* "$TARGET_DIR/src/store/" 2>/dev/null || true

# Copy config files
echo "Copying config files..."
cp "$SOURCE_REPO/tailwind.config.ts" "$TARGET_DIR/" 2>/dev/null || true
cp "$SOURCE_REPO/tsconfig.json" "$TARGET_DIR/" 2>/dev/null || true
cp "$SOURCE_REPO/tsconfig.app.json" "$TARGET_DIR/" 2>/dev/null || true
cp "$SOURCE_REPO/postcss.config.js" "$TARGET_DIR/" 2>/dev/null || true
cp "$SOURCE_REPO/index.html" "$TARGET_DIR/" 2>/dev/null || true

echo ""
echo "Files copied! Next steps:"
echo "1. Review and modify data connections (trade_logs, latency_logs)"
echo "2. Update bot control to use botControlApi service"
echo "3. Transfer to VPS and install"
