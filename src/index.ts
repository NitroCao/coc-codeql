import path from 'node:path'
import { ExtensionContext, window, workspace } from 'coc.nvim'
import { registerLanguageServer } from './lsp'

export async function activate(context: ExtensionContext): Promise<void> {
  const { nvim } = workspace

  // 1) Editor-side support: filetype detection, language configuration
  //    and tree-sitter highlighting (lua/codeql.lua).
  //
  //    The module is loaded by absolute path through a vim variable
  //    instead of adding this extension to 'runtimepath': coc watches
  //    runtimepath changes and would re-load the extension from disk,
  //    deactivating and replacing this instance (and, with it, every
  //    client and command it registered).
  await nvim.call('nvim_set_var', [
    'coc_codeql_lua_path',
    path.join(context.extensionPath, 'lua', 'codeql.lua'),
  ])
  // nvim_exec2, not the nvim 0.11-era `nvim_exec_lua` (removed in 0.12).
  await nvim.call('nvim_exec2', [
    'lua local m = dofile(vim.g.coc_codeql_lua_path) ' +
      '; _G.coc_codeql = m ; m.setup()',
    { output: false },
  ])

  // 2) Language server (diagnostics, completion, hover, definition, ...)
  const enabled = workspace
    .getConfiguration('codeql')
    .get<boolean>('languageServer.enable', true)
  if (enabled) {
    await registerLanguageServer(context)
  }

  // 3) Surface a missing tree-sitter parser. The lua side only records the
  //    failure (warning from inside lua callbacks can wedge the RPC channel
  //    of embedded editors); coc's message channel is safe to use once the
  //    editor has settled.
  const parserWarning = setTimeout(() => {
    void workspace.nvim
      .getVar('coc_codeql_parser_error')
      .then(error => {
        if (typeof error === 'string' && error.length > 0) {
          void window.showWarningMessage(
            '[coc-codeql] tree-sitter parser for ql not available ' +
              `(${error}). Install it with ` +
              '`:TSInstall ql` (nvim-treesitter) or see :h treesitter-parsers.',
          )
        }
      })
      .catch(() => {
        // The editor went away; nothing to warn about.
      })
  }, 3_000)
  context.subscriptions.push({ dispose: () => clearTimeout(parserWarning) })
}
