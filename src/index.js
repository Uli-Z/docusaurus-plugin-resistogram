// src/index.js
module.exports = function plugin(context, options) {
  return {
    name: 'docusaurus-plugin-resistogram',

    async contentLoaded({ content, actions }) {
      const { setGlobalData } = actions;
      // The data is loaded by the preset and passed to the plugin.
      // We just need to make it available to the theme.
      setGlobalData(content);
    },

    getThemePath() {
      return './theme';
    },
  };
};