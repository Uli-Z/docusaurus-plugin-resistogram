const { join } = require('path');
const { loadAllDataSync } = require('./data');

module.exports = function plugin(context, options) {
  return {
    name: 'docusaurus-plugin-resistogram',

    async loadContent() {
      const dataDir = join(context.siteDir, options.dataDir ?? 'data');
      return loadAllDataSync(dataDir, options);
    },

    async contentLoaded({ content, actions }) {
      actions.setGlobalData(content);
    },

    getThemePath() {
      return './theme';
    },
  };
};