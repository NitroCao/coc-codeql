import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeEach, describe, it } from 'node:test'
import { workspace } from 'coc.nvim'
import { ROOT, bufVar, openFile } from './helpers'

beforeEach(async () => {
  await workspace.nvim.command('enew!')
})

describe('language configuration', () => {
  it('uses // as the line comment', async () => {
    const buf = await openFile(path.join(ROOT, 'test/sample.ql'))
    assert.equal(await bufVar(buf, '&commentstring'), '// %s')
  })

  it('configures block comments with * continuation', async () => {
    const buf = await openFile(path.join(ROOT, 'test/sample.ql'))
    const comments = await bufVar<string>(buf, '&comments')
    assert.match(comments, /:\*\//) // block close
    assert.match(comments, /:\/\/$/) // line comment
  })

  it('enables comment-continuation formatoptions and drops auto-wrap', async () => {
    const buf = await openFile(path.join(ROOT, 'test/sample.ql'))
    const fo = await bufVar<string>(buf, '&formatoptions')
    for (const flag of ['c', 'r', 'o', 'q', 'l']) {
      assert.ok(fo.includes(flag), `formatoptions should include ${flag}, got '${fo}'`)
    }
    assert.ok(!fo.includes('t'), `formatoptions should drop t (auto-wrap), got '${fo}'`)
  })

  it('leaves other filetypes alone', async () => {
    const file = path.join(os.tmpdir(), 'coc-codeql-lang.txt')
    fs.writeFileSync(file, 'plain text\n')
    const buf = await openFile(file)
    assert.notEqual(await bufVar(buf, '&commentstring'), '// %s')
  })
})
