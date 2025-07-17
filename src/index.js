const path = require('path');
const { loadAllDataSync } = require('./data');
const remarkResistogram = require('./remark/transformer');

module.exports = function resistogramPlugin(context, opts = {}) {
  const dataDir = opts.dataDir ?? 'data';
  const csvData = loadAllDataSync(path.join(context.siteDir, dataDir), opts);

  return {
    name: 'docusaurus-plugin-resistogram',

    async loadContent() {
      return csvData;
    },
    async contentLoaded({ content, actions }) {
      actions.setGlobalData(content);
    },

    extendMarkdownOptions(mdOptions) {
      mdOptions.remarkPlugins = [
        ...(mdOptions.remarkPlugins || []),
        [remarkResistogram, { csvData }],
      ];
      return mdOptions;
    },

    getThemePaths() {
      return [path.join(__dirname, 'theme')];
    },
  };
};

module.exports.remarkPlugin = remarkResistogram;