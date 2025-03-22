#!/usr/bin/env node

/**
 * This script builds a single-file executable for InfiniteContext
 * inspired by the llamafile approach.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Configuration
const config = {
  outputDir: path.join(rootDir, 'dist'),
  outputFile: 'infinite-context',
  tempDir: path.join(rootDir, '.build-temp'),
  version: JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')).version,
};

// Ensure output directory exists
if (!fs.existsSync(config.outputDir)) {
  fs.mkdirSync(config.outputDir, { recursive: true });
}

// Ensure temp directory exists
if (!fs.existsSync(config.tempDir)) {
  fs.mkdirSync(config.tempDir, { recursive: true });
} else {
  // Clean temp directory
  fs.rmSync(config.tempDir, { recursive: true, force: true });
  fs.mkdirSync(config.tempDir, { recursive: true });
}

console.log('Building InfiniteContext llamafile-style executable...');

// Step 1: Build the TypeScript project
console.log('Building TypeScript project...');
execSync('npm run build', { stdio: 'inherit', cwd: rootDir });

// Step 2: Create a self-contained Node.js application
console.log('Creating self-contained application...');

// Create package.json for the bundled app
const packageJson = {
  name: 'infinite-context-bundled',
  version: config.version,
  description: 'Bundled version of InfiniteContext',
  main: 'index.js',
  type: 'module',
  dependencies: {},
};

fs.writeFileSync(
  path.join(config.tempDir, 'package.json'),
  JSON.stringify(packageJson, null, 2)
);

// Copy the built files
execSync(`cp -r ${path.join(rootDir, 'dist')}/* ${config.tempDir}/`, { stdio: 'inherit' });

// Step 3: Bundle the application with all dependencies
console.log('Bundling application with dependencies...');
execSync(`cd ${config.tempDir} && npm install --omit=dev`, { stdio: 'inherit' });

// Step 4: Create the executable wrapper script
console.log('Creating executable wrapper...');

const wrapperScript = `#!/bin/sh
# InfiniteContext Executable v${config.version}
# This is a self-contained executable for InfiniteContext

# Determine script location
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT_PATH="$SCRIPT_DIR/$(basename "$0")"

# Create temporary directory for extraction
TEMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t 'infinite-context')"
trap 'rm -rf "$TEMP_DIR"' EXIT

# Extract the bundled application
ARCHIVE_START_LINE=$(awk '/^__ARCHIVE_BELOW__/ {print NR + 1; exit 0; }' "$SCRIPT_PATH")
tail -n +"$ARCHIVE_START_LINE" "$SCRIPT_PATH" | tar xz -C "$TEMP_DIR"

# Run the application
NODE_PATH="$TEMP_DIR/node_modules" node "$TEMP_DIR/index.js" "$@"

exit $?

__ARCHIVE_BELOW__
`;

fs.writeFileSync(path.join(config.tempDir, 'wrapper.sh'), wrapperScript);
execSync(`chmod +x ${path.join(config.tempDir, 'wrapper.sh')}`, { stdio: 'inherit' });

// Step 5: Create the archive and append it to the wrapper script
console.log('Creating final executable...');
execSync(`cd ${config.tempDir} && tar czf app.tar.gz --exclude="wrapper.sh" --exclude="app.tar.gz" .`, { stdio: 'inherit' });
execSync(`cat ${path.join(config.tempDir, 'wrapper.sh')} ${path.join(config.tempDir, 'app.tar.gz')} > ${path.join(config.outputDir, config.outputFile)}`, { stdio: 'inherit' });
execSync(`chmod +x ${path.join(config.outputDir, config.outputFile)}`, { stdio: 'inherit' });

// Step 6: Clean up
console.log('Cleaning up...');
fs.rmSync(config.tempDir, { recursive: true, force: true });

console.log(`Build complete! Executable is at: ${path.join(config.outputDir, config.outputFile)}`);
console.log('You can run it with:');
console.log(`  ${path.join(config.outputDir, config.outputFile)}`);
