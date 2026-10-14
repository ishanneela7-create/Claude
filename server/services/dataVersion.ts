/** Goes up every time part data changes, so caches (like the fuzzy index) know to rebuild. */
let version = 0;

export function bumpDataVersion(): void {
  version += 1;
}

export function currentDataVersion(): number {
  return version;
}
