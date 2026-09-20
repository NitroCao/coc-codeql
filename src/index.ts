import { ExtensionContext, workspace } from 'coc.nvim'

/** Escape a path for use inside a `:set` option value. */
function escapeSetArg(path: string): string {
  return path.replace(/[\\, ]/g, '\\$&')
}

export async function activate(context: ExtensionContext): Promise<void> {
  const { nvim } = workspace

  // 1) Expose this extension's runtime files to neovim:
  //    parser/ql.so  - tree-sitter parser
  //    queries/ql/   - highlights.scm, folds.scm
  //    lua/          - require('codeql')
  await nvim.command(
    `silent! execute 'set runtimepath^=${escapeSetArg(context.extensionPath)}'`,
  )

  // 2) Register filetype detection, language configuration and
  //    tree-sitter highlighting (all in Lua, see lua/codeql.lua). This
  //    also fixes up buffers that were loaded before activation.
  //    (nvim 0.12 removed the nvim_exec_lua API function; nvim_exec2
  //    with a :lua command is the portable way.)
  await nvim.call('nvim_exec2', [
    'lua require("codeql").setup()',
    { output: false },
  ])
}
