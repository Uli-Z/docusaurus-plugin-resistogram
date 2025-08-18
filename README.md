# Docusaurus Resistogram Plugin

[![NPM Version](https://img.shields.io/npm/v/docusaurus-plugin-resistogram?style=flat-square)](https://www.npmjs.com/package/docusaurus-plugin-resistogram)
[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)

A Docusaurus v3 plugin that empowers content editors to visualize complex resistance data tables (resistograms) with a simple, powerful directive.

This plugin is designed for medical, veterinary, or scientific documentation sites. It bridges the gap between complex datasets and clear, interactive visualizations, allowing non-programmers to embed rich data tables directly into their content. The core philosophy is to handle the complexity behind the scenes, providing a seamless experience for both the editor and the reader.

![Screenshot of the ResistanceTable component](https://raw.githubusercontent.com/your-username/docusaurus-plugin-resistogram/main/screenshot.png)
*(Add a screenshot of the component to the project and link it here)*

## Features

- **Effortless for Editors:** Content creators can use a simple `%%RESIST%%` directive in their Markdown files. No coding required.
- **Smart Content Analysis (`auto` mode):** Automatically scans page content to detect and display relevant antibiotics, organisms, and even entire classes (e.g., "Cephalosporins", "gram-positive bacteria"). It intelligently ignores code blocks to avoid false positives.
- **Hierarchical Data Sources:** Define relationships between your datasets. For example, have a global dataset from EUCAST and override it with specific national or local data, which users can switch between.
- **Advanced Responsive Table:** The table is not just responsive; it adapts its display mode (`full`, `compact`, `superCompact`) based on the available width, ensuring optimal readability on any device.
- **Interactive UI:**
    - **Tooltips:** Hover over any cell or header for detailed information. Basic touch support is included.
    - **Highlighting:** Rows and columns are highlighted on hover for better data tracking.
    - **Legend:** In compact modes, a legend is automatically displayed to explain abbreviated headers.
    - **Data Source Switcher:** A clean dropdown menu allows users to switch between different data sources you provide.
- **Multi-Language Support (i18n):** The entire UI is translatable. It currently supports German, English, French, Spanish, and Italian, with English as a fallback.
- **Efficient Data Handling:** CSV files are loaded and cached on the server during the build process, ensuring fast page loads for the end-user.

## Installation

```bash
npm install docusaurus-plugin-resistogram
```

## Setup

1.  **Create a data directory** in your Docusaurus project root (e.g., `data`).
2.  **Add your data files** to this directory. See the [Data File Structure](#data-file-structure) section for details.
    - `data_sources.csv` (required)
    - `antibiotics.csv` (required)
    - `organisms.csv` (required)
    - `resistance.csv` (or other files, as defined in `data_sources.csv`)
    - `antibiotic_classes.csv` (optional)
    - `organism_classes.csv` (optional)

3.  **Configure the plugin** in your `docusaurus.config.ts`. This is a two-step process: you must register the main plugin and then register the content transformation plugin (Remark) where you want to use it (e.g., in `docs`).

    ```typescript
    // docusaurus.config.ts
    import type {Config} from '@docusaurus/types';
    import type * as Preset from '@docusaurus/preset-classic';
    // 1. Import the remark plugin
    import remarkResistogram from 'docusaurus-plugin-resistogram/remark';

    const config: Config = {
      // ...

      // 2. Configure the main plugin
      // This plugin handles data processing and makes it available to the frontend.
      plugins: [
        [
          'docusaurus-plugin-resistogram',
          {
            // Give your instance a unique ID. This is crucial.
            id: 'example-resistogram',
            dataDir: 'data', // Path to your data directory
          },
        ],
        // You can add more instances with different IDs and data directories
      ],

      // 3. Configure the remark plugin within your preset
      // This plugin finds the %%RESIST%% directives in your Markdown files.
      presets: [
        [
          'classic',
          {
            docs: {
              sidebarPath: './sidebars.ts',
              // Add the remark plugin here
              remarkPlugins: [
                // Link it to the main plugin using the same ID
                [remarkResistogram, { pluginId: 'example-resistogram' }]
              ],
            },
            // ... you can also add it to `blog` or `pages`
          } satisfies Preset.Options,
        ],
      ],
    };

    export default config;
    ```
    **Important:** The `id` in the `plugins` section must match the `pluginId` in the `remarkPlugins` section. This is how the content transformer knows which dataset to use.

## Usage

### For Content Editors

To display a resistogram, add a `%%RESIST%%` block into your MDX file. The plugin finds this block and replaces it with the interactive table. You can control what the table shows using parameters.

Think of it like giving instructions to the table:
- `abx=auto`: "Look at the text on this page and show the antibiotics you find."
- `org=all`: "Show me all the organisms you know about."
- `org="E. coli",STAPHAUR`: "Only show me *E. coli* and *Staphylococcus aureus*."
- `source=ARS`: "Use the data from the 'ARS' source."

### Directive Parameters

The `%%RESIST%%` directive accepts the following space-separated parameters. Values with spaces must be enclosed in double quotes.

| Parameter | Description                                                                                             | Values                                                                                                                            |
| :-------- | :------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------- |
| `abx`     | Specifies the antibiotics to display.                                                                   | `auto` (default), `all`, or a comma-separated list of IDs/synonyms (e.g., `PEN,"Beta-lactam"`).                                   |
| `org`     | Specifies the organisms to display.                                                                     | `auto` (default), `all`, or a comma-separated list of IDs/synonyms (e.g., `E_COLI,"gram-positive bacteria"`).                      |
| `source`  | Selects the initial data source by its ID or a synonym from `data_sources.csv`.                         | An ID or synonym (e.g., `eucast-expected`, `ARS DE 2023`). If not set, the first source sorted by year is used as a fallback. |
| `specimen`| Filters the resistance data by a specific specimen type (e.g., `urine`, `blood`). This is an exact match. | `auto` (default), or a specific string (e.g., `urine`).                                                                           |

### Examples

```mdx
<!-- Simple case: Auto-detect everything from the page content -->
%%RESIST%%

<!-- Show resistance for Penicillin and all Cephalosporins against all organisms -->
%%RESIST abx=PEN,Cephalosporins org=all%%

<!-- Automatically detect organisms from the text, but only show data for Ciprofloxacin -->
%%RESIST abx=CIP org=auto%%

<!-- Show data for all gram-positive bacteria from a specific data source -->
%%RESIST abx=all org="gram-positive bacteria" source="ARS DE 2023"%%
```

## Data File Structure

Your CSV files are the heart of the plugin. They must follow a specific structure.

### `data_sources.csv`

This file defines the different datasets you want to make available. It also supports creating a hierarchy.

| id             | parent_id      | name_de                         | year | source_file                     | ... |
| :------------- | :------------- | :------------------------------ | :--- | :------------------------------ | :-- |
| `eucast-base`  |                | EUCAST Regeln                   |      | `eucast_rules.csv`              |     |
| `ars-de-2023`  | `eucast-base`  | ARS Deutschland 2023            | 2023 | `resistance_ars_2023.csv`       |     |

- `id`: A unique identifier for the data source.
- `parent_id`: The `id` of another source to inherit data from. Data in the child source will override data from the parent.
- `name_*`: The display name for the source in the dropdown menu, localized by language (e.g., `name_de`, `name_en`).
- `year`: The year of the data, used for sorting and as a fallback for selection.
- `source_file`: The name of the CSV file containing the resistance data for this source.
- `source_long_name_*`, `source_short_name_*`, `source_url`: Additional metadata for display.

### `antibiotics.csv` & `organisms.csv`

These files define the antibiotics and organisms.

| id       | short_name | full_name           | synonyms                     |
| :------- | :--------- | :------------------ | :--------------------------- |
| `E_COLI` | E. coli    | *Escherichia coli*  | E. coli,Escherichia coli     |

- `id`: A unique identifier (required).
- `short_name`: A short name for compact table views (required).
- `full_name`: The full name for display and tooltips (required).
- `synonyms`: A comma-separated list of terms to search for in `auto` mode (required).

### Resistance Data File (e.g., `resistance.csv`)

This file contains the actual resistance values. The filename must match an entry in `data_sources.csv`.

| antibiotic_id | organism_id | n_isolates | resistance_pct | specimen |
| :------------ | :---------- | :--------- | :------------- | :------- |
| `PEN`         | `E_COLI`    | 123        | 85             | urine    |

- `antibiotic_id`: Must match an `id` in `antibiotics.csv`.
- `organism_id`: Must match an `id` in `organisms.csv`.
- `n_isolates`: The number of isolates tested.
- `resistance_pct`: The percentage of resistant isolates.
- `specimen`: (Optional) The specimen type.

### `*_classes.csv` (Optional)

You can group antibiotics and organisms into classes. The `organism_classes.csv` file supports a `parent_id` column to create a taxonomic hierarchy, which is used for sorting.

| id                  | parent_id  | name_en                 | synonyms_en        |
| :------------------ | :--------- | :---------------------- | :----------------- |
| `bacteria`          |            | Bacteria                |                    |
| `firmicutes`        | `bacteria` | Gram-positive bacteria  | Gram-positive      |

## Internationalization (i18n)

The UI text is stored in `src/theme/ResistanceTable/i18n.ts`. You can edit this file to add support for new languages or change existing translations. The system uses the current Docusaurus locale and falls back to English if a translation is missing.

## License

This project is licensed under the MIT License.