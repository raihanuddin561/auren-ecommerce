declare module 'next/dist/compiled/path-to-regexp' {
  export function match(path: string): (pathname: string) => false | { path: string };
}
