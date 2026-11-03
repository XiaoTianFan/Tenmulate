declare module 'jsfeat' {
  // The upstream package predates TypeScript. Keep its dynamic API at this boundary.
  const jsfeat: any;
  export default jsfeat;
}
