// The build's list of static files (build/statics.ts): StaticEntry in
// statics.ts, spelled out, since an ambient module cannot import a relative
// path.
declare module "virtual:quest-statics" {
  const table: readonly {
    path: string;
    file: string;
    type: string;
    immutable: boolean;
  }[];
  export default table;
}
