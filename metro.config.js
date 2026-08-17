const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// As migrations do Drizzle são arquivos .sql importados como texto (ver babel.config.js).
config.resolver.sourceExts.push('sql');

module.exports = config;
