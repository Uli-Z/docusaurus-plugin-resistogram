// src/preset.js
const { loadAllDataSync } = require('./data');
const remarkResistogram = require('./remark/transformer');

module.exports = function preset(context, options = {}) {
  const {
    docs,
    blog,
    theme,
    ...resistogramOptions
  } = options;

  const { dataDir = 'data' } = resistogramOptions;
  const csvData = loadAllDataSync(dataDir, resistogramOptions);

  const plugins = [];

  // The main plugin, now just for passing data to the theme
  plugins.push([
    require.resolve('./index.js'),
    csvData, // Pass the loaded data directly
  ]);

  // Docs plugin with the remark transformer
  if (docs) {
    plugins.push([
      '@docusaurus/plugin-content-docs',
      {
        ...docs,
        remarkPlugins: [
          ...(docs.remarkPlugins || []),
          [remarkResistogram, { csvData }], // Correctly formatted tuple
        ],
      },
    ]);
  }

  // Blog plugin with the remark transformer
  if (blog) {
    plugins.push([
      '@docusaurus/plugin-content-blog',
      {
        ...blog,
        remarkPlugins: [
          ...(blog.remarkPlugins || []),
          [remarkResistogram, { csvData }], // Correctly formatted tuple
        ],
      },
    ]);
  }

  return {
    themes: theme ? [['@docusaurus/theme-classic', theme]] : [],
    plugins,
  };
};