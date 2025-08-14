## Project Analysis: docusaurus-plugin-resistogram

This document summarizes the findings from a deep-dive analysis of the `docusaurus-plugin-resistogram` project.

### Core Functionality

The project is a Docusaurus v3 plugin designed to display antibiotic resistance data tables (resistograms) within Markdown/MDX files. It works by replacing a specific directive (`%%RESIST%%`) with a feature-rich, interactive React component (`<ResistanceTable />`).

The key functionalities are:

1.  **Data-Driven:** The plugin is driven by data from local files. It expects a specific data structure, which is more flexible than the `README.md` suggests.
2.  **Server-Side Processing:** All heavy data processing, like parsing large CSV files, happens at build-time or in the dev server (Node.js environment). This significantly improves client-side performance.
3.  **Remark/MDX Transformation:** It uses a Remark plugin to traverse the Markdown Abstract Syntax Tree (AST), find the `%%RESIST%%` directive, and replace it with the corresponding MDX component.
4.  **Interactive Frontend Component:** The final output is a sophisticated React component that offers:
    *   Multiple data source selection (e.g., different years or locations).
    *   Responsive design that automatically adjusts table compactness (`full`, `compact`, `superCompact`) based on container width.
    *   Tooltips and hover effects for better data exploration.
    *   The ability to show or hide rows/columns that have no data.
5.  **Automatic Content Detection:** It can automatically determine which antibiotics or organisms to display based on the text content of the page where it's embedded.

### Technical Implementation Details

*   **Plugin Entrypoint (`src/index.ts`):**
    *   Uses the `contentLoaded` Docusaurus lifecycle hook to orchestrate data loading and processing.
    *   It loads metadata from three main JSON files: `antibiotics.json`, `organisms.json`, and the crucial `data-src.json`.
    *   `data-src.json` defines the different data "sources" (e.g., "RKI ARS NW 2022") and points to their respective raw resistance data files (CSVs).
    *   It processes each resistance CSV, compresses it into a JSON format, and saves it to a temporary directory (`.docusaurus/docusaurus-plugin-resistogram/`). This avoids CSV parsing on the client.
    *   All shared data (metadata, synonym maps for the `auto` feature, etc.) is bundled into a `shared-resistogram-data.json`.
    *   This data is made available to the client-side components via Docusaurus's `setGlobalData` action.
    *   During a production build (`postBuild`), these generated JSON files are copied to the `build/assets/json` directory.

*   **Remark Plugin (`src/remark/index.ts`):**
    *   Scans Markdown content for paragraphs matching `%%RESIST ... %%`.
    *   Extracts the parameters (`abx`, `org`, `specimen`).
    *   Replaces the Markdown node with an `<ResistanceTable>` JSX element, passing the parameters and the full page text (for the `auto` detection) as props.
    *   Automatically injects the necessary `import` statement for the component.

*   **Frontend Component (`src/theme/ResistanceTable/`):**
    *   The main component is `index.tsx`. It uses a custom hook `useResistanceTableData` to handle all client-side data fetching and logic.
    *   This hook retrieves the global data, fetches the specific resistance data JSON based on the user-selected source, and filters it according to the component's parameters.
    *   The component features a "Render, Shrink, then Show" rendering strategy using `useIsomorphicLayoutEffect` and `ResizeObserver` to prevent layout flickering and ensure the table fits its container.
    *   It uses a single, highly performant global tooltip for all table cells, repositioning a virtual trigger element instead of rendering hundreds of individual tooltips.

### Discrepancies and Areas for Improvement

1.  **Outdated `README.md`:** The documentation is the biggest issue. It's significantly out of sync with the actual implementation.
    *   It specifies `.csv` files for antibiotics and organisms, but the example and the code use `.json`.
    *   It fails to mention the critical `data-src.json` file, which is the key to managing multiple data sources.
    *   It doesn't describe the more complex data structures used (e.g., antibiotic classes).
2.  **Unimplemented `specimen` Feature:** The `README.md` and the `%%RESIST%%` directive mention a `specimen` parameter for filtering data (e.g., by "urine" or "blood" samples). However, this functionality is not present in the data processing logic or the example data.

### Conclusion

This is a well-engineered and powerful plugin with a clear separation of concerns and several clever performance optimizations. Its main weakness is the outdated documentation, which does not reflect the more flexible and powerful capabilities of the actual implementation.