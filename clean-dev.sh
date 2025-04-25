#!/bin/bash

# Clean Next.js cache
echo "Cleaning Next.js cache..."
rm -rf .next
rm -rf node_modules/.cache

# Clear browser caches if browser-sync is installed
if command -v browser-sync &> /dev/null
then
    echo "Clearing browser caches..."
    browser-sync reload --port 3001
fi

# Start development server
echo "Starting Next.js dev server..."
next dev 