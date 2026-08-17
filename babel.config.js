module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Permite `import migration from './0000_x.sql'` — é assim que as migrations
      // do Drizzle entram no bundle do app. Sem isso, o Metro trata .sql como asset.
      ['inline-import', { extensions: ['.sql'] }],
    ],
  };
};
