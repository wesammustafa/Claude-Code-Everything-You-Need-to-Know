// The app's own helper for a dynamic import, in place of Vite's: the build
// wraps every `import()` in a call to it (build/plugins.ts,
// ownDynamicImportHelper). Vite's preloads the imported chunk's dependencies
// first; with module preload off there are none, so this only runs the import.
export function __vitePreload<T>(load: () => Promise<T>): Promise<T> {
  return load();
}
