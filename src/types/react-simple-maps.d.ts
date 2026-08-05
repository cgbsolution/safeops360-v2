// Minimal ambient types for react-simple-maps v3 (ships no bundled .d.ts).
declare module "react-simple-maps" {
  import * as React from "react";
  export const ComposableMap: React.FC<any>;
  export const Geographies: React.FC<any>;
  export const Geography: React.FC<any>;
  export const Marker: React.FC<any>;
  export const Line: React.FC<any>;
  export const Annotation: React.FC<any>;
  export const ZoomableGroup: React.FC<any>;
  export const Sphere: React.FC<any>;
  export const Graticule: React.FC<any>;
}
