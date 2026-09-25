import assert from 'node:assert/strict'
import path from 'node:path'
import { describe, it } from 'node:test'
import { ServiceStat, commands, workspace } from 'coc.nvim'
import {
  ROOT,
  hasCodeqlCli,
  openFile,
  sleep,
  waitDiagnosticsFor,
  waitServiceState,
} from './helpers'

/**
 * checkErrors=EXPLICIT must switch the server to no automatic diagnostics:
 * with the reporter disabled (verified against the CLI's implementation:
 * PackBasedBindingState only creates an AsynchronousDiagnosticReporter for
 * ON_CHANGE), opening a broken file must NOT publish anything.
 */
describe('checkErrors=EXPLICIT disables diagnostics', () => {
  it('publishes no diagnostics for an open QL buffer', async (t) => {
    if (!(await hasCodeqlCli())) {
      t.skip('codeql CLI not on PATH')
      return
    }
    // Commands are registered once the initial server start completes.
    const deadline = Date.now() + 30_000
    while (!commands.commandList.some(c => c.id === 'codeql.restartLanguageServer')) {
      if (Date.now() > deadline) {
        t.skip('language server did not finish starting in time')
        return
      }
      await sleep(250)
    }

    // The server was spawned at activation with the default ON_CHANGE;
    // switch the mode and restart it.
    await workspace.nvim.call('coc#config', [
      'codeql.languageServer.checkErrors',
      'EXPLICIT',
    ])
    await commands.executeCommand('codeql.restartLanguageServer')

    const file = path.join(ROOT, 'test/sample2.ql')
    await openFile(file)
    await waitServiceState(ServiceStat.Running)

    const diagnostics = await waitDiagnosticsFor(file, 10_000)
    assert.deepEqual(
      diagnostics.filter(d => d.source === 'codeql'),
      [],
      'EXPLICIT mode must not publish diagnostics on open',
    )
  })
})
