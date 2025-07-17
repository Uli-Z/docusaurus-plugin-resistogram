import React from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';

export default function BrowserOnlyWrapper({ component: Component, ...props }) {
  return (
    <BrowserOnly fallback={<div>Loading...</div>}>
      {() => {
        return <Component {...props} />;
      }}
    </BrowserOnly>
  );
}