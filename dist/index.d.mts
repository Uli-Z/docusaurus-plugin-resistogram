import { LoadContext, Plugin } from '@docusaurus/types';

interface Opts {
    id?: string;
    dataDir?: string;
    files?: {
        antibiotics?: string;
        organisms?: string;
        sources?: string;
        abxClasses?: string;
        orgClasses?: string;
    };
}
declare function docusaurusPluginResistogram(ctx: LoadContext, opts?: Opts): Plugin;

export { docusaurusPluginResistogram as default };
