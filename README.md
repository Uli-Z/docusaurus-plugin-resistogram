# Docusaurus Resistogram Plugin

A Docusaurus v3 plugin to display resistance data tables (resistograms) from simple CSV files.

This plugin scans your Markdown files for keywords and automatically displays relevant resistance data. It's designed for medical, veterinary, or scientific documentation sites that need to show antibiotic resistance patterns.

![Screenshot of the ResistanceTable component](https://raw.githubusercontent.com/your-username/docusaurus-plugin-resistogram/main/screenshot.png)
*(Add a screenshot of the component to the project and link it here)*

## Features

- **Automatic Detection:** Scans page content to automatically select relevant antibiotics, organisms, and even entire classes (e.g., "Cephalosporins", "gram-positive bacteria").
- **Hierarchical Resolution:** Understands nested classifications of organisms and antibiotics.
- **Customizable Display:** Use simple directives in your Markdown to control which data is shown.
- **Automatic Sorting:** Organisms are automatically sorted by their taxonomic classification for clear and consistent presentation.
- **Responsive Design:** The table adapts to different screen sizes for optimal viewing on any device.
- **Simple Data Source:** Uses straightforward CSV files as the data source.

## Installation

```bash
npm install docusaurus-plugin-resistogram
```

## Setup

1.  **Create a data directory** in your Docusaurus project root (e.g., `data`).
2.  **Add your data files** to this directory. You'll need up to five CSV files:

    - `antibiotics.csv` (required)
    - `organisms.csv` (required)
    - `resistance.csv` (required)
    - `antibiotic_classes.csv` (optional, for grouping antibiotics)
    - `organism_classes.csv` (optional, for grouping and sorting organisms)

3.  **Configure the plugin** in your `docusaurus.config.ts`:

    ```typescript
    // docusaurus.config.ts
    import type {Config} from '@docusaurus/types';

    const config: Config = {
      // ...
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

- `auto`: (Default) Automatically detects relevant IDs from the page content based on synonyms defined in your CSV files. This includes individual items and class names.
- `all`: Displays all available antibiotics or organisms.
- **Comma-separated list:** A list of specific IDs or class names/synonyms from your CSV files (e.g., `abx=PEN,Cephalosporins` or `org=B_STPHY_AURS,Enterobacterales`).

**Example:**

```mdx
<!-- Show resistance for Penicillin and all Cephalosporins against all organisms -->
%%RESIST abx=PEN,Cephalosporins org=all%%

<!-- Automatically detect organisms from the text, but only show data for Ciprofloxacin -->
%%RESIST abx=CIP org=auto%%

<!-- Show data for all gram-positive bacteria -->
%%RESIST abx=all org="gram-positive bacteria"%%
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

| antibiotic_id | organism_id | n_isolates | resistance_pct | specimen |
| ------------- | ----------- | ---------- | -------------- | -------- |
| PEN           | E_COLI      | 123        | 85             | urine    |
| PEN           | S_AUREUS    | 45         | 15             | blood    |
| AMX           | E_COLI      | 120        | 90             | urine    |

- `antibiotic_id`: The ID of the antibiotic (must match an ID in `antibiotics.csv`).
- `organism_id`: The ID of the organism (must match an ID in `organisms.csv`).
- `n_isolates`: The number of isolates tested.
- `resistance_pct`: The percentage of isolates that were resistant.
- `specimen`: (Optional) The specimen type (e.g., `urine`, `blood`, `wound`).

### `antibiotic_classes.csv` (Optional)

This file defines classes for grouping antibiotics.

| id    | name_en        | synonyms_en             |
| ----- | -------------- | ----------------------- |
| CEPH1 | Cephalosporins | Cephalosporin           |
| PENI  | Penicillins    | Penicillin, Beta-lactam |

- `id`: A unique identifier for the class (required).
- `name_*`: The display name of the class in different languages.
- `synonyms_*`: A comma-separated list of terms to search for.

### `organism_classes.csv` (Optional)

This file defines a potentially nested hierarchy for organisms.

| id                  | parent_id | name_en                 | synonyms_en        |
| ------------------- | --------- | ----------------------- | ------------------ |
| bacteria            |           | Bacteria                |                    |
| firmicutes          | bacteria  | Gram-positive bacteria  | Gram-positive      |
| enterococcaceae     | firmicutes| Enterococcaceae         | Enterococci        |

- `id`: A unique identifier for the class (required).
- `parent_id`: The `id` of the parent class to create a hierarchy. Leave empty for top-level classes.
- `name_*`: The display name of the class.
- `synonyms_*`: A comma-separated list of terms to search for.

## License

This project is licensed under the MIT License.
