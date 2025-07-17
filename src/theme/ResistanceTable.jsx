import React from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import ResistanceTableContent from './ResistanceTableContent';

export default function ResistanceTable({ data: jsonData }) {
  console.debug('[Resistogram-Debug] ResistanceTable component mounting with JSON data:', jsonData);

  return (
    <BrowserOnly>
      {() => {
        try {
          const parsedData = JSON.parse(jsonData);
          console.debug('[Resistogram-Debug] Data parsed successfully:', parsedData);
          return <ResistanceTableContent {...parsedData} />;
        } catch (e) {
          console.error('[Resistogram-Debug] Failed to parse JSON data for ResistanceTable:', e);
          return <div>Error: Invalid data format.</div>;
        }
      }}
    </BrowserOnly>
  );
}
