import assert from 'node:assert/strict'
import path from 'node:path'
import { beforeEach, describe, it } from 'node:test'
import { ServiceStat, commands, services, workspace } from 'coc.nvim'
import { resolveCli, serverArgs } from '../src/lsp.ts'
import {
  ROOT,
  bufVar,
  hasCodeqlCli,
  openFile,
  waitDiagnosticsFor,
  waitServiceState,
} from './helpers'

beforeEach(async () => {
  await workspace.nvim.command('enew!')
})

describe('CLI resolution', () => {
  it('resolves codeql from PATH by default', async (t) => {
    if (!(await hasCodeqlCli())) {
      t.skip('codeql CLI not on PATH')
      return
    }
    const cli = await resolveCli()
    assert.ok(cli && path.isAbsolute(cli), `expected an absolute path, got ${cli}`)
  })

  it('honors an absolute codeql.cliPath', async () => {
    await workspace.nvim.call('coc#config', ['codeql.cliPath', process.execPath])
    assert.equal(await resolveCli(), process.execPath)
    await workspace.nvim.call('coc#config', ['codeql.cliPath', 'codeql'])
  })

  it('returns undefined for a CLI that does not exist', async () => {
    await workspace.nvim.call('coc#config', [
      'codeql.cliPath',
      'coc-codeql-no-such-binary',
    ])
    assert.equal(await resolveCli(), undefined)
    await workspace.nvim.call('coc#config', ['codeql.cliPath', 'codeql'])
  })
})

describe('server arguments', () => {
  it('defaults to --check-errors ON_CHANGE', () => {
    assert.equal(
      JSON.stringify(serverArgs()),
      JSON.stringify(['execute', 'language-server', '--check-errors', 'ON_CHANGE']),
    )
  })

  it('passes the configured checkErrors mode through', async () => {
    await workspace.nvim.call('coc#config', [
      'codeql.languageServer.checkErrors',
      'EXPLICIT',
    ])
    assert.equal(
      JSON.stringify(serverArgs()),
      JSON.stringify(['execute', 'language-server', '--check-errors', 'EXPLICIT']),
    )
    await workspace.nvim.call('coc#config', [
      'codeql.languageServer.checkErrors',
      'ON_CHANGE',
    ])
  })
})

// The remaining suites exercise the live language server; they need the
// codeql CLI on this machine.
describe('language server', () => {
  it('is spawned at activation and attaches to QL buffers', async (t) => {
    if (!(await hasCodeqlCli())) {
      t.skip('codeql CLI not on PATH')
      return
    }
    // Opening a QL file makes coc's service wrapper start; diagnostics
    // prove the server received didOpen and published results.
    const file = path.join(ROOT, 'test/sample.ql')
    const buf = await openFile(file)
    assert.equal(await bufVar(buf, '&filetype'), 'ql')
    await waitServiceState(ServiceStat.Running)

    // sample.ql imports ql libraries that no qlpack in this workspace can
    // resolve — the server must publish exactly those as diagnostics.
    const diagnostics = await waitDiagnosticsFor(file)
    assert.ok(
      diagnostics.length > 0,
      'expected diagnostics to be published for the open QL buffer',
    )
    assert.ok(
      diagnostics.some(d => d.source === 'codeql'),
      `expected diagnostics from source "codeql", got ${JSON.stringify(diagnostics)}`,
    )
  })

  it('exposes the restart command', async (t) => {
    if (!(await hasCodeqlCli())) {
      t.skip('codeql CLI not on PATH')
      return
    }
    const ids = commands.commandList.map(c => c.id)
    assert.ok(ids.includes('codeql.restartLanguageServer'))
  })

  it('restarts cleanly via codeql.restartLanguageServer', async (t) => {
    if (!(await hasCodeqlCli())) {
      t.skip('codeql CLI not on PATH')
      return
    }
    const file = path.join(ROOT, 'test/sample.ql')
    await openFile(file)
    await waitServiceState(ServiceStat.Running)

    await commands.executeCommand('codeql.restartLanguageServer')
    assert.equal(services.getService('codeql')?.state, ServiceStat.Running)
  })
})
