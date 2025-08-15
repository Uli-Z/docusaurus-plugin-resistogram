import { LoadContext, Plugin } from '@docusaurus/types';

interface Opts {
    dataDir?: string;
    files?: {
        antibiotics?: string;
        organisms?: string;
        sources?: string;
    };
}
declare function docusaurusPluginResistogram(ctx: LoadContext, opts?: Opts): Plugin;

export { docusaurusPluginResistogram as default };
