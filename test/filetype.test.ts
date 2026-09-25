import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeEach, describe, it } from 'node:test'
import { workspace } from 'coc.nvim'
import { ROOT, bufVar, openFile } from './helpers'

let scratch: string

beforeEach(async () => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'coc-codeql-test-'))
  await workspace.nvim.command('enew!')
})

describe('filetype detection', () => {
  it('sets filetype=ql for .ql files', async () => {
    const buf = await openFile(path.join(ROOT, 'test/sample.ql'))
    assert.equal(await bufVar(buf, '&filetype'), 'ql')
  })

  it('sets filetype=ql for .qll files', async () => {
    const file = path.join(scratch, 'lib.qll')
    fs.writeFileSync(file, 'class C extends int { }\n')
    const buf = await openFile(file)
    assert.equal(await bufVar(buf, '&filetype'), 'ql')
  })

  it('sets filetype=ql for newly created (unsaved) .ql buffers', async () => {
    const buf = await openFile(path.join(scratch, 'new-query.ql'))
    assert.equal(await bufVar(buf, '&filetype'), 'ql')
  })

  it('does not touch non-CodeQL files', async () => {
    const file = path.join(scratch, 'notes.txt')
    fs.writeFileSync(file, 'select "hello"\n')
    const buf = await openFile(file)
    assert.notEqual(await bufVar(buf, '&filetype'), 'ql')
  })

  it('repairs buffers whose filetype was reset after setup ran', async () => {
    // Simulates a buffer that predates the extension's setup(): the fix-up
    // loop in lua/codeql.lua must restore filetype=ql.
    const buf = await openFile(path.join(ROOT, 'test/sample.ql'))
    await workspace.nvim.call('setbufvar', [buf, '&filetype', ''])
    await workspace.nvim.lua('_G.coc_codeql.setup()')
    assert.equal(await bufVar(buf, '&filetype'), 'ql')
  })

  it('is idempotent: re-running setup() keeps a single autocmd set', async () => {
    const count = async (): Promise<number> =>
      (await workspace.nvim.eval(
        'luaeval("vim.tbl_count(vim.api.nvim_get_autocmds({ group = \'coc_codeql\' }))")',
      )) as number
    const before = await count()
    await workspace.nvim.lua('_G.coc_codeql.setup()')
    assert.equal(await count(), before)
  })
})
