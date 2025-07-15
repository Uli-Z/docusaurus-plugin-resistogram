docusaurus-plugin-resistogram – Gemini AI Context

TL;DR

A drop‑in Docusaurus v3 plugin that turns Markdown placeholders of the form %%RESIST …%% into an interactive ResistanceTable React component.

It ships two sub‑modules:

Layer

Module

Responsibility

Data plugin

src/

Load CSVs (antibiotics.csv, organisms.csv, resistance.csv), build synonym → ID maps, expose everything via actions.setGlobalData().

Theme shadow

src/theme/ResistanceTable

UI for the resistogram, incl. Radix dropdown, specimen filter, heat‑map cells & CSV‑export.

A separate remark plugin is provided in `src/remark` that needs to be manually added to the docusaurus config.

Install from GitHub (npm i github:owner/docusaurus-plugin-resistogram#<tag>) and register in docusaurus.config.ts:

```javascript
plugins: [
  [
    "docusaurus-plugin-resistogram",
    {
      dataDir: "resist-data" // optional
    }
  ]
],
presets: [
  [
    "@docusaurus/preset-classic",
    {
      docs: {
        remarkPlugins: [require("docusaurus-plugin-resistogram/dist/remark")],
      },
    },
  ],
],
```

Scope

In scope: resistance table generation, CSV ingestion, UI styling.

Out of scope: automatic hyperlinking in prose, multi‑project data sync, i18n routing (yet), automatic detection of antibiotics and organisms.

Runtime Data Contracts

All CSVs are comma‑separated, UTF‑8, with header row.

antibiotics.csv: id,synonyms,full_name,short_name

organisms.csv:  id,synonyms,full_name,short_name

resistance.csv: antibiotic_id,organism_id,specimen,resistance_pct,n_isolates

Plugin Options

interface Options {
  dataDir?: string;      // default "data"
  files?: {
    antibiotics?: string; // default "antibiotics.csv"
    organisms?:   string; // default "organisms.csv"
    resistance?:  string; // default "resistance.csv"
  };
}

Internal Module Map

src/
├─ index.ts              // data plugin
├─ data/
│  └─ csv.ts             // generic CSV helpers
├─ remark/
│  └─ index.ts           // remark plugin
└─ theme/
   └─ ResistanceTable/
      ├─ index.tsx       // React component
      └─ styles.module.css

Coding Standards

TypeScript strict ("strict": true, ES2022 target).

File naming: kebab-case for folders, camelCase for files except index.ts[x].

Prefer named exports; default export only for the top‑level plugin and React components.

Keep modules ≤ 200 LOC; refactor otherwise.

Pure functions where possible; side effects isolated in plugin hooks.

Formatting enforced by Prettier (printWidth 80, tabWidth 2).

Lint via ESLint using eslint-config-airbnb-typescript + @typescript-eslint.

Paths: use Node path & URL‑safe imports; no deep relative ../../..—prefer @/ ts‑path‑alias.

Commit messages follow Conventional Commits (feat:, fix:, chore:…).

All public APIs (options, CSV schema) documented in JSDoc blocks.

Testing Guidelines

Remark plugin: Jest snapshot tests with unified().use(remarkResist) for edge cases.

ResistanceTable: React Testing Library, mock usePluginData, verify cell render & specimen switch.

E2E smoke: Docusaurus build of examples/minimal, expect zero broken links.

CI / Prepare Script

npm run build (tsup → dist/) executes in prepare, so git installs auto‑compile.  No artefacts committed.  Node >= 18.

---
## Detailed Migration Plan for New Dataset Integration

This plan outlines the comprehensive steps required to refactor the plugin to support the new hierarchical, multilingual dataset.

### Part 1: Backend Logic Refactoring (Node.js Build-Time)

This phase focuses on data loading, processing, and intelligent reduction within the Docusaurus build environment.

**1. Data Loading and Structuring (`src/data/index.ts`)**

*   **Objective:** Load all necessary data files into memory and build efficient data structures for processing.
*   **Actions:**
    *   Read `data_sources.csv` to understand the available datasets and their relationships.
    *   Read `antibiotics.csv` and `organisms.csv` for metadata.
    *   Read *all* resistance CSVs referenced in `data_sources.csv`.
    *   **In-Memory Representation:**
        *   **Metadata:** Store antibiotics and organisms in `Map<amr_code, Antibiotic>` and `Map<amr_code, Organism>` for O(1) lookup.
        *   **Data Source Hierarchy:** Create a tree structure. Each node will represent a data source and contain its metadata (`id`, `names`, `source_file`) and pointers to its parent and children (`parent_id`, `children: [...]`). This allows for efficient traversal of the hierarchy.
        *   **Resistance Data:** Store all resistance data points in a nested map for fast access: `Map<source_id, Map<organism_id, Map<antibiotic_id, ResistanceData>>>`.
    *   **Special Handling for `eucast_expected_resistance.csv`:**
        *   During the loading process, treat this file as a standard data source.
        *   Programmatically transform its rows: for each `{ antibiotic_id, organism_id }`, create a full data point `{ antibiotic_id, organism_id, resistance_pct: 100, n_isolates: 0 }`.
        *   Virtually insert an entry for EUCAST into the data source hierarchy (e.g., as a root node with `id: 'eucast'`) so it can be selected in the UI.

**2. Remark Plugin Overhaul (`src/remark/index.ts`)**

*   **Objective:** Intercept the `%%RESIST%%` directive, determine the context, perform aggressive data pruning, and pass a minimal, optimized JSON payload to the frontend component.
*   **Actions:**
    *   **Leverage Docusaurus Context for i18n:**
        *   Access the current page's language via `context.i18n.currentLocale`.
        *   Create a translation helper function, e.g., `getTranslatedValue(item, fieldName, locale)`. This function will attempt to access `item[\`\${fieldName}_\${locale}\`]` and fall back to `item[\`\${fieldName}_en\`]` if the specific language column doesn't exist. This applies to all user-facing strings like `full_name`, `short_name`, and `synonyms`.
    *   **Entity Resolution:**
        *   Parse the `abx`, `org`, and `source` parameters from the directive.
        *   For `abx=auto` or `org=auto`, scan the current MDX page content (`vfile.value`) for all matching synonyms (using the i18n-aware synonym list). Collect the corresponding `amr_code`s.
        *   For explicit lists (`abx=PEN,AMX`), use those `amr_code`s directly.
        *   The result is a definitive list of `relevant_antibiotic_codes` and `relevant_organism_codes`.
    *   **Intelligent Data Pruning:** This is the most critical step for performance.
        1.  **Filter Metadata:** From the global maps, create smaller maps containing only the `Antibiotic` and `Organism` objects whose `amr_code`s are in the `relevant_*_codes` lists.
        2.  **Filter Resistance Data:** Traverse the main resistance data map and build a new, smaller map containing only the data points for the relevant codes.
        3.  **Filter Data Sources:** A source is relevant if it (or one of its ancestors in the hierarchy) contains at least one data point for the relevant entities.
            *   Implement a recursive function that marks a source and all its parents as "relevant" if it contains a needed data point.
            *   Construct a new, pruned source tree containing only the relevant sources.
    *   **Default Source Selection (`source=auto`):**
        *   Implement a Depth-First Search (DFS) algorithm on the *pruned* source tree.
        *   The algorithm will find the path with the most nodes (the "deepest" branch). The leaf node of this path becomes the `defaultSelectedSourceId`.
        *   If the user provides `source=rki-2023`, this overrides the auto-selection.
    *   **Final Data Handover:**
        *   Assemble a single, clean JSON object containing: `pruned_metadata`, `pruned_resistance_data`, `pruned_source_tree`, and `defaultSelectedSourceId`.
        *   Serialize this object and embed it as a prop for the `ResistanceTable` React component.

### Part 2: Frontend Refactoring (React `ResistanceTable` Component)

The component becomes a "dumb" but interactive renderer, with all heavy logic removed.

**1. State Management**

*   **Objective:** Simplify state to only manage user interaction.
*   **Actions:**
    *   The component receives the final, pruned data as props.
    *   The primary state managed by `useState` will be `selectedSourceId`, initialized from the `defaultSelectedSourceId` prop.

**2. Hierarchical Source Selector UI**

*   **Objective:** Provide an intuitive way for the user to select a data source.
*   **Actions:**
    *   Create a dropdown menu component.
    *   Implement a recursive rendering function (`renderSourceNode(node, indentationLevel)`) to display the `pruned_source_tree` prop. The `indentationLevel` will be used to add padding/margins, visually representing the hierarchy.
    *   The `onClick` handler for each item in the dropdown will simply call `setSelectedSourceId(node.id)`.
    *   The dropdown will only contain the relevant, pre-filtered sources passed from the backend.

**3. Data Display Logic**

*   **Objective:** For each cell in the table, find and display the correct resistance value based on the selected source and the hierarchy.
*   **Actions:**
    *   Create a memoized helper function, e.g., `getDisplayValue(antibiotic_code, organism_code, source_id)`.
    *   **Hierarchical Lookup:**
        1.  This function first attempts to find the resistance value in the `pruned_resistance_data` for the currently `selectedSourceId`.
        2.  If no value is found, it looks up the `parent_id` of the current source in the `pruned_source_tree`.
        3.  It then recursively calls itself with the `parent_id`.
        4.  This continues until a value is found or the root of the tree is reached.
    *   The main component iterates through the relevant antibiotics and organisms and uses this function to render the value in each table cell, applying appropriate styling (e.g., color-coding for the resistance percentage). All display names are taken directly from the pre-translated props.