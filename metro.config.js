const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// op-sqlite / @rocicorp/zero ship .wasm and .sql assets that Metro must bundle.
config.resolver.assetExts.push('wasm', 'sql');

module.exports = withNativeWind(config, { input: './src/global.css' });
