/* eslint-disable @typescript-eslint/no-var-requires */
const { build } = require('esbuild')

const watch = process.argv.includes('--watch')
const production = process.argv.includes('--production')

const options = {
  bundle: true,
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  external: ['coc.nvim'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: watch ? 'inline' : false,
  minify: production,
}

if (watch) {
  const ctx = require('esbuild').context
  ctx(options).then((ctx) => {
    console.log('[coc-codeql] watching for changes...')
    ctx.watch()
  })
} else {
  build(options).then(() => {
    console.log('[coc-codeql] build complete: lib/index.js')
  })
}
