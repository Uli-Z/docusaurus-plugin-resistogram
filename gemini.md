# Docusaurus Plugin Resistogram - Gemini AI Context

## Current Status & Problem

We have successfully identified the root cause of the build failures thanks to expert feedback. The core issues were:

1.  **Invalid Plugin Configuration:** The `docusaurus.config.ts` used `require.resolve()` which passes a *string* (the plugin's path) to Docusaurus. However, when a plugin is passed with an options object, Docusaurus's schema validator expects a *function* (the plugin itself). The correct approach is to use `require()`.
2.  **File Access Timing:** The remark plugin was attempting to read the `loaded-data.json` file at initialization time. At this point in the Docusaurus lifecycle, the main plugin has not run yet, and the file does not exist.

The timing issue has been fixed by moving the `readJsonSync` call inside the returned transformer function, making it "lazy".

The primary remaining problem is a series of TypeScript type errors that occur when trying to programmatically add an `import` statement to the MDX AST. The manual object creation for the import node is not satisfying the strict types required by `unified` and `mdast`.

## Revised Action Plan

The goal is to achieve a fully type-safe, successful build where the `%%RESIST%%` directive is correctly replaced.

1.  **Fix Type-Safe Import Generation:**
    *   Add the `unist-builder` library as a dependency.
    *   Modify `src/remark/index.ts` to use the `u('mdxjsEsm', ...)` builder function from this library to create a type-safe AST node for the `import` statement. This will resolve the final blocking TypeScript error.

2.  **Re-enable Type Checking:**
    *   Modify the `build` script in `package.json` to re-enable the generation of TypeScript declaration files (`--dts`) for the entire project. A clean, type-safe build is the goal.

3.  **Verify Configuration:**
    *   Ensure the `example/docusaurus.config.ts` uses the correct `require('../dist/remark')` syntax in the `remarkPlugins` array.

4.  **Full Build & Verification:**
    *   Run `npm run build` in the root directory to compile the plugin with full type checking.
    *   Run `npm run build` in the `example/` directory.
    *   Inspect the final HTML output (`example/build/docs/Resistogramm/index.html`) to confirm that the `%%RESIST%%` directive has been successfully replaced by the React component.
