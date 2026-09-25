import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeEach, describe, it } from 'node:test'
import { workspace } from 'coc.nvim'
import { ROOT, bufVar, findParserDir, openFile, sleep } from './helpers'

const HIGHLIGHTER_ACTIVE = async (buf: number): Promise<boolean> =>
  Boolean(
    await workspace.nvim.lua(
      `return vim.treesitter.highlighter.active[${buf}] ~= nil`,
    ),
  )

/**
 * The highlighter is started from a timer (starting it inside the FileType
 * autocmd wedges the RPC loop of embedded editors), so assertions must
 * poll instead of expecting it synchronously.
 */
async function waitForHighlighter(
  buf: number,
  want: boolean,
  timeoutMs = 5_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if ((await HIGHLIGHTER_ACTIVE(buf)) === want) return
    await sleep(50)
  }
  assert.equal(await HIGHLIGHTER_ACTIVE(buf), want)
}

/**
 * Drop every runtimepath entry that ships a ql parser (restorable). Also
 * neutralizes vim.notify for as long as the parser is hidden: the
 * parser-missing warning echoes through vim.notify, which can stall the
 * RPC loop of the test harness's embedded editor.
 */
async function hideQlParser(): Promise<void> {
  await workspace.nvim.lua(`
    local removed = {}
    for _, dir in ipairs(vim.opt.runtimepath:get()) do
      if vim.uv.fs_stat(dir .. '/parser/ql.so') then
        table.insert(removed, dir)
        vim.opt.runtimepath:remove(dir)
      end
    end
    _G.coc_codeql_hidden_rtp = removed
    _G.coc_codeql_notify = vim.notify
    vim.notify = function() end
  `)
}

async function restoreQlParser(): Promise<void> {
  await workspace.nvim.lua(`
    for _, dir in ipairs(_G.coc_codeql_hidden_rtp or {}) do
      vim.opt.runtimepath:append(dir)
    end
    _G.coc_codeql_hidden_rtp = nil
    if _G.coc_codeql_notify then
      vim.notify = _G.coc_codeql_notify
      _G.coc_codeql_notify = nil
    end
  `)
}

/** Copy the discovered parser + queries into a temp dir on the runtimepath. */
async function injectParserDir(parserDir: string): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coc-codeql-rtp-'))
  fs.mkdirSync(path.join(dir, 'parser'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'queries'), { recursive: true })
  fs.copyFileSync(
    path.join(parserDir, 'parser', 'ql.so'),
    path.join(dir, 'parser', 'ql.so'),
  )
  fs.cpSync(
    path.join(parserDir, 'queries', 'ql'),
    path.join(dir, 'queries', 'ql'),
    { recursive: true },
  )
  await workspace.nvim.command(`set runtimepath^=${dir.replaceAll(' ', '\\ ')}`)
  return dir
}

beforeEach(async () => {
  // Wipe all buffers: nvim reuses a buffer when its file is opened again,
  // and a reused buffer does not re-fire FileType — the tests must each
  // exercise a fresh open.
  await workspace.nvim.command('silent! %bwipeout!')
})

describe('tree-sitter highlighting', () => {
  it('degrades gracefully when no ql parser is installed', async () => {
    await hideQlParser()
    try {
      const buf = await openFile(path.join(ROOT, 'test/sample.ql'))
      assert.equal(await bufVar(buf, '&filetype'), 'ql')
      assert.equal(await HIGHLIGHTER_ACTIVE(buf), false)
    } finally {
      await restoreQlParser()
    }
  })

  // Must run before any test that loads the ql language: nvim caches a
  // loaded parser for the session, so "no parser available" can no longer
  // be reproduced afterwards.
  it('starts the highlighter for a buffer whose parser appears after setup', async (t) => {
    const parserDir = findParserDir()
    if (!parserDir) {
      t.skip('no ql tree-sitter parser found (set COC_CODEQL_PARSER_DIR to provide one)')
      return
    }
    // Buffer opened while no parser was reachable (highlighter start was
    // skipped); once a parser becomes reachable, the fix-up pass of
    // setup() must attach the highlighter.
    await hideQlParser()
    const buf = await openFile(path.join(ROOT, 'test/sample.ql'))
    assert.equal(await HIGHLIGHTER_ACTIVE(buf), false)

    await injectParserDir(parserDir)
    await restoreQlParser()
    await workspace.nvim.lua('_G.coc_codeql.setup()')
    await waitForHighlighter(buf, true)
  })

  it('starts the highlighter when a parser is available', async (t) => {
    const parserDir = findParserDir()
    if (!parserDir) {
      t.skip('no ql tree-sitter parser found (set COC_CODEQL_PARSER_DIR to provide one)')
      return
    }
    await injectParserDir(parserDir)
    const buf = await openFile(path.join(ROOT, 'test/sample.ql'))
    assert.equal(await bufVar(buf, '&filetype'), 'ql')
    await waitForHighlighter(buf, true)

    // Effectiveness: the highlights query must actually produce captures.
    const captures = (await workspace.nvim.lua(`
      local query = vim.treesitter.query.get('ql', 'highlights')
      local parser = vim.treesitter.get_parser(0, 'ql')
      local tree = parser:parse()[1]
      local n = 0
      for _ in query:iter_captures(tree:root(), 0, 0, -1) do n = n + 1 end
      return n
    `)) as unknown as number
    assert.ok(
      captures > 100,
      `expected a meaningful number of highlight captures, got ${captures}`,
    )
  })
})
