#!/bin/bash

set -e

echo "🚀 Setting up Bunner Development Environment..."
echo "📦 Setting up system..."
echo "[SYSTEM] Updating packages..."
sudo apt-get update -qq -y

echo "[SYSTEM] Upgrading packages..."
sudo apt-get upgrade -qq -y

echo "🔧 Install project dependencies..."
bun install

echo ""
echo "🎉 Bunner Development Environment setup completed!"
echo "🚀 Ready to start development!"
