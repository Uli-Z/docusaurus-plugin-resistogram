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

    configureWebpack(config, isServer, utils) {
      const { getJSLoader } = utils;
      return {
        module: {
          rules: [
            {
              test: /\.mdx$/,
              use: [
                getJSLoader({ isServer }),
                {
                  loader: require.resolve('@docusaurus/mdx-loader'),
                  options: {
                    remarkPlugins: [[remarkResistogram, { csvData }]],
                  },
                },
              ],
            },
          ],
        },
      };
    },

    getThemePaths() {
      return [path.join(__dirname, 'theme')];
    },
  };
};