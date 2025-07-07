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
