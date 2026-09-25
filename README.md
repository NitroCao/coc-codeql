# coc-codeql

[CodeQL](https://codeql.github.com/) language support for
[coc.nvim](https://github.com/neoclide/coc.nvim) — an editor companion
to the CodeQL CLI, following the editing experience of the official
[vscode-codeql](https://github.com/github/vscode-codeql) extension.

## Features

- **Language server integration** — diagnostics, completion, hover,
  definition, references, document symbols, formatting, rename and
  inlay hints, with pack resolution through the qlpack and the package
  cache (`codeql pack install`)
- **Filetype detection** for `*.ql` / `*.qll`
- **Language configuration** — `//` line comments, block comment
  continuation, comment-aware `formatoptions`
- **Tree-sitter highlighting & folding**

This extension is a pure editor integration: the language intelligence
lives in the CodeQL CLI, the parser and highlight queries are provided
by your editor's tree-sitter toolchain, and nothing is bundled here.

## Requirements

- neovim ≥ 0.9 (developed and tested on 0.12)
- coc.nvim ≥ 0.0.82
- the CodeQL CLI ≥ 2.x on `PATH` (or set `codeql.cliPath`)
- the `ql` tree-sitter parser, installed through the tree-sitter
  ecosystem:

```vim
:TSInstall ql
```

> nvim-treesitter registers the
> [tree-sitter-ql](https://github.com/samlanning/tree-sitter-ql)
> grammar and ships its queries. The revision currently pinned in
> nvim-treesitter's lockfile mis-parses `true()`/`false()` (QL has no
> boolean literals); if that bites you, install a fixed parser build
> into your nvim site directory manually (`:h treesitter-parsers`).
> Without a parser, highlighting degrades gracefully with a warning;
> every other feature works.

## Install

```vim
:CocInstall coc-codeql
```

## Configuration

```jsonc
{
  // Path to the CodeQL CLI executable: a name resolved on PATH
  // (default "codeql") or an absolute path. Resolved once at
  // activation; if it cannot be found, a warning is shown and the
  // language-server features are disabled (editor features remain).
  // Changing it requires :CocRestart.
  "codeql.cliPath": "codeql",

  // Start the CodeQL language server at all. When false, no client and
  // no commands are registered; filetype detection, language
  // configuration and highlighting are unaffected.
  "codeql.languageServer.enable": true,

  // How the server checks for QL errors — passed as --check-errors.
  //   "ON_CHANGE" (default): diagnostics are compiled and published
  //     in the background as you edit (live diagnostics).
  //   "EXPLICIT": the server runs no background checking and never
  //     publishes diagnostics; useful to silence diagnostics on slow
  //     machines or huge workspaces while keeping completion, hover
  //     and definition. Despite the name, there is no way to request
  //     checks on demand in the current protocol (verified against
  //     CLI 2.27.0).
  // Re-read whenever the server starts (activation or restart).
  "codeql.languageServer.checkErrors": "ON_CHANGE"
}
```

Commands:

| Command | Effect |
| --- | --- |
| `:CocCommand codeql.restartLanguageServer` | Restart the language server (re-reads `checkErrors`). |

Protocol details and semantics:
[docs/language-server.md](docs/language-server.md).

## Development

```sh
pnpm build        # esbuild → lib/index.js (also runs on pnpm install)
pnpm watch        # rebuild on change
pnpm typecheck    # tsc --noEmit for src and tests
pnpm lint         # eslint — errors on any @deprecated API usage
pnpm lint:md      # markdownlint over all markdown files
pnpm check        # typecheck + lint + lint:md
pnpm test         # test/*.test.ts — the feature suite (coc-test)
pnpm test:variants # test/variants/* — configuration-variant suites
pnpm test:all     # check + both test suites
```

The LSP suites skip when `codeql` is not on `PATH`. The highlighting
suites that need a real parser skip when none is found; point
`COC_CODEQL_PARSER_DIR` at a directory containing `parser/ql.so` and
`queries/ql/` to provide one. `test:variants` injects settings before
activation through `COC_CODEQL_SETTINGS`
(see `scripts/test-setup.mjs`).

## Roadmap

Measured against vscode-codeql's feature set (query execution,
database management, variant analysis, …), this extension currently
implements the language-editing foundation. Plans:

**Editing experience**

- [x] Language server: diagnostics, completion, hover, definition,
      references, document symbols, formatting, rename
- [x] Syntax highlighting & folding (tree-sitter)
- [x] Filetype detection and language configuration
- [ ] Semantic tokens / richer highlighting from the server
- [ ] Inlay hints exposure (the server supports them; coc wiring needed)

**Query development**

- [ ] Run query against the current database
      (`codeql query run` / the query server)
- [ ] Quick evaluation of the selected predicate/expressions
- [ ] Results viewing (export to CSV/SARIF, a results buffer)
- [ ] Query history
- [ ] `.qltest` test running and output comparison

**Database management**

- [ ] Database selection UI (`:CocList`-style picker)
- [ ] Database overview (language, upgrade hints)

**Workspace & packs**

- [ ] `codeql pack install` / dependency management commands
- [ ] qlpack-aware workspace features (smart workspace detection)

## License

MIT
