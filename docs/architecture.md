# Architecture

How coc-codeql is put together, and where the boundaries to the rest of the
tree-sitter ecosystem are.

## Components

```
┌─────────────────────────────────────────────────────────────┐
│ neovim                                                      │
│                                                             │
│  ┌───────────────────────┐   ┌───────────────────────────┐  │
│  │ coc.nvim              │   │ nvim-treesitter           │  │
│  │  └─ coc-codeql (TS)   │   │  ├─ parser/ql.so          │  │
│  │     └─ lua/codeql.lua │   │  └─ queries/ql/*.scm      │  │
│  │     └─ codeql LSP ────┼──▶│                           │  │
│  └───────────────────────┘   └───────────────────────────┘  │
│                                                             │
│  other tree-sitter consumers: helix, emacs, zed, …          │
└─────────────────────────────────────────────────────────────┘
                     │
                     │  (standalone project, separate repo)
                     ▼
        /data/dev/tree-sitter-ql  (fork of
        samlanning/tree-sitter-ql — grammar fixes + queries)
```

Three moving parts, three owners:

| Part | Lives in | Role |
| --- | --- | --- |
| grammar + queries | `tree-sitter-ql` fork repo | language definition, upstreamable |
| parser + queries at runtime | nvim-treesitter / manual install | editor toolchain distributes them |
| editor glue | this extension | filetype, config, LSP |

This split follows tree-sitter ecosystem conventions: grammars are
standalone projects and editors ship them through their own tooling.
The extension deliberately bundles **no parser and no queries**.

## Highlighting pipeline

1. coc activates the extension at startup (`activationEvents: ["*"]` — it
   must, because filetype detection itself comes from the extension).
2. `activate()` (src/index.ts) prepends the extension directory to
   `runtimepath` and runs `require('codeql').setup()` via `nvim_exec2`
   (nvim 0.12 removed the `nvim_exec_lua` API function).
3. `lua/codeql.lua` registers:
   - `BufReadPost`/`BufNewFile` for `*.ql`/`*.qll` → `filetype=ql`
     (neovim has no built-in detection; coc.nvim does not implement
     VSCode's `contributes.languages` detection)
   - `FileType` for `ql` → language configuration
     (`commentstring=// %s`, `comments`, `formatoptions`) and
     `vim.treesitter.start(buf, 'ql')`
   - a fix-up pass for buffers loaded before activation
4. Parser and queries resolve from the editor's runtimepath —
   `:TSInstall ql` (nvim-treesitter registers the `tree-sitter-ql`
   grammar and ships its own `queries/ql/`), or a manual install into
   e.g. `~/.local/share/nvim/site/{parser,queries}/ql/` per
   `:h treesitter-parsers`.

If the parser is missing, highlighting degrades with a warning that
explains the install options. If nvim-treesitter's highlight module
already started a highlighter, the extension stays out of the way.

## tree-sitter-ql fork

Location: `../tree-sitter-ql` (independent git repo, MIT, attribution to
Sam Lanning). Delta vs upstream:

- `true()` / `false()` / `none()` are zero-arity predicates — QL has no
  boolean literals. The revision pinned by nvim-treesitter's lockfile
  (`1fd627a`) mis-parses `if c then true() else false()`.
- raw tabs allowed inside string literals
- the class-member field rule is renamed `fieldDecl` (`field` is a
  reserved word in tree-sitter query syntax)
- maintained `queries/ql/{highlights,folds}.scm` (declaration vs call
  distinction, `@module` for import paths, `@variable.member` for
  fields, `@label` for select aliases — the queries shipped inside
  nvim-treesitter color import paths as `@variable`)

Regenerate after editing `grammar/grammar.js`:

```sh
pnpm parser            # tree-sitter generate (ABI 15, matching nvim 0.12) + cc
```

The fork exists to be upstreamed (to samlanning/tree-sitter-ql and/or the
nvim-treesitter lockfile), not to be bundled here.
