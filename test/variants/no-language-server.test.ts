import assert from 'node:assert/strict'
import path from 'node:path'
import { describe, it } from 'node:test'
import { commands, services } from 'coc.nvim'
import { ROOT, bufVar, openFile, sleep } from '../helpers'

/**
 * Run via `pnpm test:variants` with
 * COC_CODEQL_SETTINGS='{"codeql":{"languageServer":{"enable":false}}}'.
 * With the language server disabled, the editor-side features must keep
 * working and nothing may be registered on the LSP side.
 */
describe('codeql.languageServer.enable=false', () => {
  it('keeps filetype detection but registers no service or commands', async () => {
    const buf = await openFile(path.join(ROOT, 'test/sample.ql'))
    assert.equal(await bufVar(buf, '&filetype'), 'ql')

    await sleep(1_000)
    assert.equal(services.getService('codeql'), undefined)
    const ids = commands.commandList.map(c => c.id)
    assert.ok(!ids.includes('codeql.restartLanguageServer'))
  })
})
