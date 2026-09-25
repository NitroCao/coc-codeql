import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { ServiceStat, services, workspace } from 'coc.nvim'
import { hasCodeqlCli, openFile, sleep, waitServiceState } from './helpers'

/**
 * The documentSelector must attach the language server to QL files and to
 * the CodeQL yaml manifests — and to nothing else. coc only activates the
 * service wrapper for documents matching the selector, so the wrapper
 * state is an observable proxy for the selector.
 */
describe('document selector', () => {
  it('does not attach to unrelated files', async (t) => {
    if (!(await hasCodeqlCli())) {
      t.skip('codeql CLI not on PATH')
      return
    }
    const file = path.join(os.tmpdir(), 'coc-codeql-selector.txt')
    fs.writeFileSync(file, 'select "not codeql"\n')
    await openFile(file)
    await sleep(2_000)
    assert.notEqual(
      services.getService('codeql')?.state,
      ServiceStat.Running,
      'service must not start for a .txt buffer',
    )
  })

  it('attaches to qlpack.yml manifests', async (t) => {
    if (!(await hasCodeqlCli())) {
      t.skip('codeql CLI not on PATH')
      return
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coc-codeql-pack-'))
    const file = path.join(dir, 'qlpack.yml')
    fs.writeFileSync(file, 'name: example/pack\nversion: 0.0.0\n')
    await openFile(file)
    await waitServiceState(ServiceStat.Running)
    const ft = await workspace.nvim.call('getbufvar', ['%', '&filetype'])
    assert.equal(ft, 'yaml')
  })
})
