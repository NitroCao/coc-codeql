import assert from 'node:assert/strict'
import path from 'node:path'
import { describe, it } from 'node:test'
import { commands, services } from 'coc.nvim'
import { ROOT, bufVar, openFile, sleep } from '../helpers'

/**
 * Run via `pnpm test:variants` with
 * COC_CODEQL_SETTINGS='{"codeql":{"cliPath":"/nonexistent/codeql"}}'.
 * A missing CLI must degrade to editor-only features: no service, no
 * commands, but highlighting/filetype keep working.
 */
describe('missing codeql CLI', () => {
  it('disables LSP features but keeps editor features', async () => {
    const buf = await openFile(path.join(ROOT, 'test/sample.ql'))
    assert.equal(await bufVar(buf, '&filetype'), 'ql')

    await sleep(1_000)
    assert.equal(services.getService('codeql'), undefined)
    const ids = commands.commandList.map(c => c.id)
    assert.ok(!ids.includes('codeql.restartLanguageServer'))
  })
})
