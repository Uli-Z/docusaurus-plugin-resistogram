export interface Source {
  id: string;
  parent_id?: string;
  name_de: string;
  year: number;
  source_short_name_de?: string;
  long_name?: string;
  url?: string;
  source_file: string;
  children?: Source[];
  [key: string]: any; // Allow for dynamic properties like name_en, long_name_fr etc.
}
