# docusaurus-plugin-resistogram

A Docusaurus plugin to display resistograms based on CSV data.

## Installation

```bash
npm i github:<OWNER>/docusaurus-plugin-resistogram#v0.1.0
```

## Usage

1.  Create a directory for your CSV data (e.g., `resist-data`). It should contain `antibiotics.csv`, `organisms.csv`, and `resistance.csv`.

2.  In your `docusaurus.config.ts`, add the plugin:

    ```typescript
    plugins: [
      [
        "docusaurus-plugin-resistogram",
        {
          dataDir: "resist-data" // Defaults to "data"
          /* files: { antibiotics:"abx.csv", ... } */ // Optional
        }
      ]
    ]
    ```

3.  In your MDX files, use the `%%RESIST%%` directive:

    ```mdx
    %%RESIST abx=auto org=auto%%
    ```

    This will be replaced by a `ResistanceTable` component.