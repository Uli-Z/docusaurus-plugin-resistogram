docusaurus-plugin-resistogram – Gemini AI Context

TL;DR

A drop‑in Docusaurus v3 plugin that turns Markdown placeholders of the form %%RESIST …%% into an interactive ResistanceTable React component.It ships three sub‑modules:

Layer

Module

Responsibility

Data plugin

src/data

Load CSVs (antibiotics.csv, organisms.csv, resistance.csv), build synonym → ID maps, expose everything via actions.setGlobalData().

Remark plugin

src/remark

Parse Markdown, detect organism/antibiotic mentions (no link replacement), resolve auto / all keywords, inject <ResistanceTable params="…" />.

Theme shadow

src/theme/ResistanceTable

UI for the resistogram, incl. Radix dropdown, specimen filter, heat‑map cells & CSV‑export.

Install from GitHub (npm i github:owner/docusaurus-plugin-resistogram#<tag>) and register in docusaurus.config.ts:

plugins: [[
  "docusaurus-plugin-resistogram",
  { dataDir: "resist-data" } // optional
]]

Scope

In scope: resistance table generation, auto/all logic, CSV ingestion, UI styling.

Out of scope: automatic hyperlinking in prose, multi‑project data sync, i18n routing (yet).

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
├─ index.ts              // registers data + remark plugins
├─ data/
│  ├─ csv.ts             // generic CSV helpers
│  └─ index.ts           // data plugin implementation
├─ remark/
│  └─ index.ts           // remark plugin (no linkification)
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

Remark plugin: Jest snapshot tests with unified().use(remarkResist) for edge cases (auto, multiline paragraph, no hits).

ResistanceTable: React Testing Library, mock usePluginData, verify cell render & specimen switch.

E2E smoke: Docusaurus build of examples/minimal, expect zero broken links.

CI / Prepare Script

npm run build (tsup → dist/) executes in prepare, so git installs auto‑compile.  No artefacts committed.  Node >= 18.
