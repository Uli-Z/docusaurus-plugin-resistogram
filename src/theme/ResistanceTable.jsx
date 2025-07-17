import React from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import ResistanceTableContent from './ResistanceTableContent';

export default function ResistanceTable({ data: jsonData }) {
  console.debug('[Resistogram-Debug] ResistanceTable component mounting. Received data keys:', Object.keys(JSON.parse(jsonData)));

  return (
    <BrowserOnly>
      {() => {
        try {
          const parsedData = JSON.parse(jsonData);
          return <ResistanceTableContent {...parsedData} />;
        } catch (e) {
          console.error('[Resistogram-Debug] Failed to parse JSON data for ResistanceTable:', e);
          return <div>Error: Invalid data format.</div>;
        }
      }}
    </BrowserOnly>
  );
}
