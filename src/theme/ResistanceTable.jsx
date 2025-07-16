import React from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';

function ResistanceTable(props) {
  return (
    <BrowserOnly fallback={<div>Loading...</div>}>
      {() => {
        const ResistanceTableContent = require('./ResistanceTableContent.jsx').default;
        return <ResistanceTableContent {...props} />;
      }}
    </BrowserOnly>
  );
}

export default ResistanceTable;