// wrangler empaqueta los .wasm como módulos compilados (CompiledWasm).
declare module '*.wasm' {
  const module: WebAssembly.Module;
  export default module;
}
