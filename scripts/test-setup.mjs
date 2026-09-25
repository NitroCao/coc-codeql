/**
 * coc-test setup hook (see the `coc-test.setup` key in package.json).
 *
 * Runs inside the test child after the editor and coc.nvim are up, but
 * before the extension is activated — so configuration applied through
 * `coc#config()` here is visible to the extension at activation time.
 * (Writing coc-settings.json would be too late: coc reads it when it
 * attaches.)
 *
 * Environment overrides:
 *
 *   COC_CODEQL_SETTINGS  JSON object of coc settings, e.g.
 *                        '{"codeql":{"languageServer":{"enable":false}}}'.
 *                        Used by the `test:variants` npm script to run
 *                        selected test files under a different extension
 *                        configuration.
 */
const extraSettings = process.env.COC_CODEQL_SETTINGS
if (extraSettings) {
  const coc = globalThis.__coc_test_coc_exports__
  if (!coc?.workspace?.nvim) {
    throw new Error('coc-test setup: coc.nvim runtime is not available')
  }
  const settings = JSON.parse(extraSettings)
  for (const [key, value] of Object.entries(flatten(settings))) {
    await coc.workspace.nvim.call('coc#config', [key, value])
  }
}

function flatten(obj, prefix = '') {
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    const name = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flatten(value, name))
    } else {
      result[name] = value
    }
  }
  return result
}
