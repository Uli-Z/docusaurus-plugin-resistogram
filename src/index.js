const { join } = require('path');
const { ensureDirSync, writeJsonSync } = require('fs-extra');
const { loadAllData } = require('./data');

// Helper to serialize Maps for JSON, as they are not supported by default
const replacer = (key, value) => {
  if (value instanceof Map) {
    return {
      dataType: 'Map',
      value: Array.from(value.entries()),
    };
  } else {
    return value;
  }
};

const plugin = (context, options) => {
  const { siteDir, pluginId } = context;
  const pluginDataDir = join(
    context.generatedFilesDir,
    `docusaurus-plugin-resistogram-${pluginId}`,
  );
  ensureDirSync(pluginDataDir);

  const dataDir = join(siteDir, options.dataDir ?? 'data');
  const dataFilePath = join(pluginDataDir, 'loaded-data.json');

  return {
    name: 'docusaurus-plugin-resistogram',

    async loadContent() {
      return await loadAllData(dataDir, options);
    },

    async contentLoaded({ content, actions }) {
      const { setGlobalData } = actions;
      setGlobalData(content);
      writeJsonSync(dataFilePath, content, { replacer });
    },

    getThemePath() {
      return './theme';
    },
  };
};

module.exports = plugin;
