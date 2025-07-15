// src/types.ts

// Represents a single antibiotic from antibiotics.csv
export interface Antibiotic {
  amr_code: string;
  class: string;
  full_name_de: string;
  full_name_en: string;
  short_name_de: string;
  short_name_en: string;
  synonyms_de: string;
  synonyms_en: string;
}

// Represents a single organism from organisms.csv
export interface Organism {
  amr_code: string;
  class_id: string;
  full_name_de: string;
  full_name_en: string;
}

// Represents a single resistance data point from a resistance-*.csv file
export interface Resistance {
  antibiotic_id: string;
  organism_id: string;
  resistance_pct: number;
  n_isolates: number;
}

// Represents a single data source from data_sources.csv
export interface DataSource {
  id: string;
  parent_id: string | null;
  name_de: string;
  name_en: string;
  source_long_name_de: string;
  source_long_name_en: string;
  source_short_name_de: string;
  source_short_name_en: string;
  source_url: string;
  source_file: string;
}

// Represents a node in the hierarchical tree of data sources
export interface DataSourceNode extends DataSource {
  children: DataSourceNode[];
}

// Represents the fully loaded and structured data available to the plugin
export interface LoadedData {
  antibiotics: Map<string, Antibiotic>;
  organisms: Map<string, Organism>;
  sourceTree: DataSourceNode;
  resistance: Map<string, Resistance[]>; // Keyed by source_id
}

// Type definition for the plugin options in docusaurus.config.ts
export interface PluginOptions {
  dataDir?: string;
  files?: {
    antibiotics?: string;
    organisms?: string;
    data_sources?: string;
  };
}
