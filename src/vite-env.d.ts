/// <reference types="vite/client" />

declare module "svg-path-to-polygons" {
    export function pathDataToPolys(d: string): number[][];
}
  
declare module '@luma.gl/core' {
    export const CubeGeometry: any
}