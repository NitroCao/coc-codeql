import { spawn as spawnChild, type ChildProcess } from 'node:child_process'
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  commands,
  services,
  window,
  workspace,
} from 'coc.nvim'
import type { ExtensionContext } from 'coc.nvim'

/**
 * Resolve the CodeQL CLI. Honors `codeql.cliPath`, otherwise falls back
 * to `codeql` on PATH. Returns an absolute path or undefined.
 *
 * NOTE: configuration keys read through getConfiguration('codeql') are
 * relative to that section — `get('cliPath')`, not
 * `get('codeql.cliPath')` (an absolute key silently resolves to a
 * doubled prefix and reads nothing).
 */
export async function resolveCli(): Promise<string | undefined> {
  const config = workspace.getConfiguration('codeql')
  const cliPath = config.get<string>('cliPath', 'codeql')
  const resolved: string = await workspace.nvim.call('exepath', [cliPath])
  return resolved === '' ? undefined : resolved
}

/**
 * Arguments for `codeql execute language-server`, derived from the
 * current configuration. Re-evaluated on every server start, so
 * configuration changes take effect after a restart.
 */
export function serverArgs(): string[] {
  const config = workspace.getConfiguration('codeql')
  const checkErrors = config.get<'ON_CHANGE' | 'EXPLICIT'>(
    'languageServer.checkErrors',
    'ON_CHANGE',
  )
  return ['execute', 'language-server', '--check-errors', checkErrors]
}

/**
 * Create and register the CodeQL language server client.
 *
 * Server: `codeql execute language-server --check-errors ON_CHANGE`
 * (stdio LSP; provides diagnostics, completion, hover, definition,
 * references, documentSymbol, formatting, rename and inlay hints).
 *
 * Pack resolution works out of the box: the server discovers qlpacks
 * recursively under the workspace folders that coc sends in
 * `initialize` (the server ignores `rootUri` alone), and resolves
 * dependencies through the pack cache (`codeql pack install`,
 * `~/.codeql/packages`); no `--search-path` is needed.
 */
export async function registerLanguageServer(
  context: ExtensionContext,
): Promise<void> {
  const cli = await resolveCli()
  if (!cli) {
    void window.showWarningMessage(
      '[coc-codeql] codeql CLI not found; set "codeql.cliPath". ' +
        'LSP features are disabled.',
    )
    return
  }

  // The function form of ServerOptions spawns the server ourselves on
  // every start. Two reasons not to use the static `{ command, args }`
  // form: coc appends `--stdio` for explicit stdio transports, which the
  // codeql CLI rejects as an unknown option, and static args would be
  // frozen at activation — `codeql.languageServer.checkErrors` could no
  // longer take effect across restarts.
  let serverProcess: ChildProcess | undefined
  const serverOptions: ServerOptions = async () => {
    serverProcess?.kill()
    serverProcess = spawnChild(cli, serverArgs())
    return serverProcess
  }

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { language: 'ql', scheme: 'file' },
      { language: 'yaml', scheme: 'file', pattern: '**/qlpack.yml' },
      { language: 'yaml', scheme: 'file', pattern: '**/codeql-pack.yml' },
      { language: 'yaml', scheme: 'file', pattern: '**/codeql-workspace.yml' },
    ],
    outputChannelName: 'codeql',
  }

  const client = new LanguageClient(
    'codeql',
    'CodeQL Language Server',
    serverOptions,
    clientOptions,
  )
  context.subscriptions.push(services.registerLanguageClient(client))
  context.subscriptions.push({
    dispose: () => serverProcess?.kill(),
  })
  await client.start()

  context.subscriptions.push(
    commands.registerCommand(
      'codeql.restartLanguageServer',
      async () => {
        await client.stop()
        await client.start()
        void window.showInformationMessage(
          '[coc-codeql] language server restarted',
        )
      },
    ),
  )
}
