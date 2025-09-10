import React from 'react';

// Import plugin-wide CSS variables and global styles so they are included
// in the extracted CSS during both dev and production builds.
// Using a theme Root wrapper ensures consistent CSS loading order.
import '../plugin.css';

export default function Root({children}) {
  return <>{children}</>;
}

