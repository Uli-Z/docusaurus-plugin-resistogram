declare function mdastToPlainText(root: any): string;
declare function remarkResistogram(options: {
    dataDir?: string;
    files?: any;
    pluginId?: string;
}): (tree: any, file: any) => Promise<any>;

export { remarkResistogram as default, mdastToPlainText };
