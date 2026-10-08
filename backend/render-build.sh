#!/usr/bin/env bash
# exit on error
set -o errexit

echo "Starting build..."

# Set Puppeteer cache directory within the project folder
export PUPPETEER_CACHE_DIR=/opt/render/project/puppeteer

# Install dependencies
npm ci --omit=dev

# Install Chromium for Puppeteer
echo "Installing Puppeteer Browsers..."
npx puppeteer browsers install chrome

echo "Build finished successfully!"
