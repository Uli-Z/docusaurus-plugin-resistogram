# Docusaurus Resistogram Plugin

A Docusaurus v3 plugin to display resistance data tables (resistograms) from simple CSV files.

This plugin scans your Markdown files for keywords and automatically displays relevant resistance data. It's designed for medical, veterinary, or scientific documentation sites that need to show antibiotic resistance patterns.

![Screenshot of the ResistanceTable component](https://raw.githubusercontent.com/your-username/docusaurus-plugin-resistogram/main/screenshot.png)
*(Add a screenshot of the component to the project and link it here)*

## Features

- **Automatic Detection:** Scans page content to automatically select relevant antibiotics and organisms.
- **Customizable Display:** Use simple directives in your Markdown to control which data is shown.
- **Responsive Design:** The table adapts to different screen sizes for optimal viewing on any device.
- **Simple Data Source:** Uses straightforward CSV files as the data source.

## Installation

```bash
npm install docusaurus-plugin-resistogram
```

## Setup

1.  **Create a data directory** in your Docusaurus project root (e.g., `data`).
2.  **Add your data files** to this directory. You'll need three CSV files:

    - `antibiotics.csv`
    - `organisms.csv`
    - `resistance.csv`

3.  **Configure the plugin** in your `docusaurus.config.ts`:

    ```typescript
    // docusaurus.config.ts
    import type {Config} from '@docusaurus/types';

    const config: Config = {
      // ...
      presets: [
        [
          'classic',
          {
            docs: {
              remarkPlugins: [
                require('docusaurus-plugin-resistogram').remarkPlugin,
              ],
            },
          },
        ],
      ],
      plugins: [
        [
          'docusaurus-plugin-resistogram',
          {
            // Path to the directory containing your CSV files.
            dataDir: 'data', // Defaults to 'data'
          },
        ],
      ],
    };

    export default config;
    ```

## Usage

To display a resistogram, add a `%%RESIST%%` directive in your MDX files. The plugin will replace this directive with the `ResistanceTable` component.

```mdx
Here is the resistance data for Penicillin:

%%RESIST abx=auto org=all specimen=auto%%
```

### Directive Parameters

The `%%RESIST%%` directive accepts three space-separated parameters:

- `abx`: Specifies the antibiotics to display.
- `org`: Specifies the organisms to display.
- `specimen`: Filters the data by a specific specimen type (e.g., `urine`, `blood`).

### Parameter Values

Each parameter can take one of the following values:

- `auto`: (Default) Automatically detects relevant IDs from the page content based on synonyms defined in your CSV files.
- `all`: Displays all available antibiotics or organisms.
- **Comma-separated list:** A list of specific IDs from your CSV files (e.g., `abx=PEN,AMX,CIP`).

**Example:**

```mdx
<!-- Show resistance for Penicillin and Amoxicillin against all organisms -->
%%RESIST abx=PEN,AMX org=all%%

<!-- Automatically detect antibiotics, but only show E. coli and S. aureus -->
%%RESIST abx=auto org=E_COLI,S_AUREUS%%

<!-- Show data for all antibiotics, but only from urine samples -->
%%RESIST abx=all org=all specimen=urine%%
```

## Data File Structure

Your CSV files must follow a specific structure.

### `antibiotics.csv`

| id  | short_name | full_name   | synonyms              |
| --- | ---------- | ----------- | --------------------- |
| PEN | Pen        | Penicillin  | Penicillin,Penicillins |
| AMX | Amx        | Amoxicillin | Amoxicillin           |

- `id`: A unique identifier for the antibiotic (required).
- `short_name`: A short name used for compact table views (required).
- `full_name`: The full name of the antibiotic (required).
- `synonyms`: A comma-separated list of terms to search for in `auto` mode (required).

### `organisms.csv`

| id       | short_name | full_name           | synonyms                     |
| -------- | ---------- | ------------------- | ---------------------------- |
| E_COLI   | E. coli    | *Escherichia coli*  | E. coli,Escherichia coli     |
| S_AUREUS | S. aureus  | *Staphylococcus...* | S. aureus,Staphylococcus... |

- `id`: A unique identifier for the organism (required).
- `short_name`: A short name used for compact table views (required).
- `full_name`: The full, scientific name of the organism (required).
- `synonyms`: A comma-separated list of terms to search for in `auto` mode (required).

### `resistance.csv`

| antibiotic_id | organism_id | n_isolates | resistance_pct |
| ------------- | ----------- | ---------- | -------------- |
| PEN           | E_COLI      | 123        | 85             |
| PEN           | S_AUREUS    | 45         | 15             |
| AMX           | E_COLI      | 120        | 90             |

- `antibiotic_id`: The ID of the antibiotic (must match an ID in `antibiotics.csv`).
- `organism_id`: The ID of the organism (must match an ID in `organisms.csv`).
- `n_isolates`: The number of isolates tested.
- `resistance_pct`: The percentage of isolates that were resistant.

## License

This project is licensed under the MIT License.
