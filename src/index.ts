import type { LoadContext, Plugin, DocusaurusContent } from '@docusaurus/types';
import { join } from 'path';
import { loadAllData } from './data';
import type { PluginOptions, LoadedData } from './types';
import remarkPlugin from './remark';

export default function pluginResistogram(
  context: LoadContext,
  options: PluginOptions,
): Plugin<LoadedData> {
  const { siteDir } = context;
  const dataDir = join(siteDir, options.dataDir ?? 'data');

  return {
    name: 'docusaurus-plugin-resistogram',

    async loadContent() {
      // Load all data from CSVs into memory
      return await loadAllData(dataDir, options);
    },

    async contentLoaded({ content, actions }) {
      const { setGlobalData } = actions;
      // Make all loaded data available to theme components
      setGlobalData(content);
    },

    getThemePath() {
      return './theme';
    },

    getRemarkPlugins() {
      // Here, we access the data loaded in `loadContent` and pass it to the remark plugin.
      // Docusaurus ensures this hook is called after `loadContent` and `contentLoaded`.
      const content = this.content as LoadedData;
      return [[remarkPlugin, content]];
    },
  };
}
