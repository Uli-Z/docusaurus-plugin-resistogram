import type {
  LoadContext,
  Plugin,
  PluginContentLoadedActions,
} from '@docusaurus/types';
import { join } from 'path';
import { ensureDirSync, writeJsonSync } from 'fs-extra';
import { loadAllData } from './data';
import type { PluginOptions, LoadedData } from './types';

// Helper to serialize Maps for JSON, as they are not supported by default
const replacer = (key: any, value: any) => {
  if (value instanceof Map) {
    return {
      dataType: 'Map',
      value: Array.from(value.entries()),
    };
  } else {
    return value;
  }
};

const plugin: Plugin<LoadedData> = (
  context: LoadContext,
  options: PluginOptions,
) => {
  const { siteDir, pluginId } = context as LoadContext & { pluginId: string };
  const pluginDataDir = join(
    context.generatedFilesDir,
    `docusaurus-plugin-resistogram-${pluginId}`,
  );
  ensureDirSync(pluginDataDir);

  const dataDir = join(siteDir, options.dataDir ?? 'data');
  const dataFilePath = join(pluginDataDir, 'loaded-data.json');

  return {
    name: 'docusaurus-plugin-resistogram',

    async loadContent(): Promise<LoadedData> {
      return await loadAllData(dataDir, options);
    },

    async contentLoaded({
      content,
      actions,
    }: {
      content: LoadedData;
      actions: PluginContentLoadedActions;
    }) {
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

