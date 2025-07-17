# Docusaurus Plugin Resistogram - Gemini AI Context

## Current Status & Problem

We have successfully identified the root cause of the build failures thanks to expert feedback. The core issues were:

1.  **Invalid Plugin Configuration:** The `docusaurus.config.ts` used `require.resolve()` which passes a *string* (the plugin's path) to Docusaurus. However, when a plugin is passed with an options object, Docusaurus's schema validator expects a *function* (the plugin itself). The correct approach is to use `require()`.
2.  **File Access Timing:** The remark plugin was attempting to read the `loaded-data.json` file at initialization time. At this point in the Docusaurus lifecycle, the main plugin has not run yet, and the file does not exist.

The timing issue has been fixed by moving the `readJsonSync` call inside the returned transformer function, making it "lazy".

The primary remaining problem is a series of TypeScript type errors that occur when trying to programmatically add an `import` statement to the MDX AST. The manual object creation for the import node is not satisfying the strict types required by `unified` and `mdast`.