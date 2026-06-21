import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'schemas/index': 'src/schemas/index.ts',
    'state/index': 'src/state/index.ts',
    'theme/index': 'src/theme/index.ts',
    'ui/index': 'src/ui/index.ts',
    'client/index': 'src/client/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  outDir: 'dist',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
});
