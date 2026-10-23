import { plugin } from 'bun';
plugin({ name: 'deno-imports', setup(build) {
  build.onResolve({ filter: /^npm:zod@3$/ }, () => ({ path: import.meta.resolve('zod').replace('file://', '') }));
} });