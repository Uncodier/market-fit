/// <reference path="./react-simple-maps.d.ts" />
/// <reference path="./topojson-client.d.ts" />

// Declaración global para módulos sin tipos
declare module '*.json' {
  const value: any;
  export default value;
} 