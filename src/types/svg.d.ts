// For SVGs imported as React Components (using vite-plugin-svgr)
declare module '*.svg?react' {
  import * as React from 'react';

  // Define the React component's type (a functional component)
  const Component: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;

  // This is the default export when using the ?react suffix
  export default Component;
}