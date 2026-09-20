# Development

Build, test and the gotchas that cost time during this migration.

## Setup

```sh
# register the extension with coc (global extensions must be listed in
# ~/.config/coc/extensions/package.json "dependencies" — a bare symlink
# under node_modules is NOT picked up by coc's scanner)
python3 - <<'EOF'
import json, pathlib
p = pathlib.Path("~/.config/coc/extensions/package.json").expanduser()
pkg = json.loads(p.read_text())
pkg["dependencies"]["coc-codeql"] = "file:/data/dev/coc-codeql"
p.write_text(json.dumps(pkg, indent=2))
EOF
ln -sfn /data/dev/coc-codeql ~/.config/coc/extensions/node_modules/coc-codeql

cd /data/dev/coc-codeql && pnpm install && pnpm build
```

```sh
pnpm build        # esbuild -> lib/index.js (also runs on pnpm install)
pnpm watch        # rebuild on change
pnpm typecheck    # tsc --noEmit
```

## Testing (headless)

All test scripts live in /tmp (scratch), the samples in `test/`:

- `test/sample.ql` — exercises the full tree-sitter grammar, must parse
  with **zero errors**
- `test/errors.ql` — error recovery (unterminated string, stray tokens)
- `/data/dev/vuln-java` — real project used for LSP verification
  (`codeql pack install` once, database optional)

### Grammar / highlighting

```sh
cd ../tree-sitter-ql
tree-sitter parse test/sample.ql | grep -c "(ERROR"   # -> 0
```

Highlight capture dump (no coc needed): headless nvim script that
prepends the parser's runtimepath, `setf ql`, and walks
`query:iter_captures`.

### coc integration

Headless harness pattern (`nvim --headless -u script.vim`):

```vim
set runtimepath^=~/.local/share/nvim/lazy/coc.nvim
runtime plugin/coc.vim          " -u FILE does NOT auto-source rtp plugins
function! s:Start() abort
  if !get(g:, 'coc_service_initialized', 0)
    call timer_start(300, {-> s:Start()})   " poll, never block:
    return                                   " init only fires at VimEnter
  endif
  " ... assertions via coc#rpc#request(...)
endfunction
au User CocNvimInit call timer_start(1000, {-> s:Start()})
```

Assertions used:
- `coc#rpc#request('listLoadItems', ['services'])` — client state
  (`*  codeql  [running]  ql, yaml`)
- `coc#rpc#request('diagnosticList', [])` — live diagnostics
- `luaeval('vim.treesitter.highlighter.active[...] ~= nil')` — TS started
- syntax captures both for buffers opened **before** and **after** coc
  activation (two scenarios, both must pass)

### LSP

Live check: open `ExecTainted.ql`, wait for compile, inject a bogus
line with `append()` and poll `diagnosticList` until errors appear,
then delete the line. (Never `:w` — keep the working tree clean.)

For raw protocol experiments use a stdio probe script (spawn
`codeql execute language-server`, speak JSON-RPC by hand) — see
docs/language-server.md for the findings this produced.

## Gotchas encountered (and their fixes)

| Symptom | Cause | Fix |
| --- | --- | --- |
| extension never loads | coc only scans extensions listed in `~/.config/coc/extensions/package.json` `dependencies` | add `"coc-codeql": "file:…"` + symlink |
| `nvim_exec_lua` unknown function | removed in nvim 0.12 | `nvim.call('nvim_exec2', ['lua …', {output:false}])` |
| `contributes.languages` has no effect | coc.nvim never implemented VSCode's language-contribution detection | ship our own detection (Lua autocmds) |
| language server crash-loops (`crashed 5 times`) | coc appends `--stdio` for explicit `TransportKind.stdio`; codeql CLI rejects unknown options | omit `transport` in ServerOptions |
| server starts, all imports unresolved | `initialize.workspaceFolders` missing (rootUri alone is ignored by the server) | nothing to do — coc fills it from its root detection |
| headless coc test hangs forever | init script blocked in a sleep loop; `VimEnter` (and thus coc init) never fired | poll with timers, never block startup |
| `-u FILE` doesn't load coc | rtp plugins aren't auto-sourced in this mode | explicit `runtime plugin/coc.vim` |
| `workspace.showMessage is not a function` | API moved | it lives on the `window` namespace of coc.nvim |
| highlight query "Impossible pattern" / "Invalid node type field" | `field` is a reserved word in query syntax | renamed the grammar rule to `fieldDecl` |
| tree-sitter ABI mismatch | CLI version vs nvim's bundled tree-sitter | generate with tree-sitter-cli 0.25.x (ABI 15) for nvim 0.12 |

## Versions this was built against

- neovim 0.12.2 (tree-sitter ABI 15)
- coc.nvim 0.0.82 (release), `coc.nvim` npm typings 0.0.83-next.9
- CodeQL CLI 2.27.0
- nvim-treesitter main branch (`ql` registered, revision `1fd627a`)
