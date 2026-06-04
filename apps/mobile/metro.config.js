const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

// --- Bun-workspace monorepo setup -------------------------------------------
// Metro must watch the repo root (shared/hoisted packages) and resolve modules
// from both the app and the hoisted root node_modules.
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// op-sqlite / @rocicorp/zero ship .wasm and .sql assets that Metro must bundle.
config.resolver.assetExts.push('wasm', 'sql');

module.exports = withNativeWind(config, { input: './src/global.css' });
