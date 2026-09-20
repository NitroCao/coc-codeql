# coc-codeql

[CodeQL](https://codeql.github.com/) language support for
[coc.nvim](https://github.com/neoclide/coc.nvim), migrated from the official
[vscode-codeql](https://github.com/github/vscode-codeql) extension.

This extension is **pure editor integration** — it does not bundle a
tree-sitter parser or queries. Per tree-sitter ecosystem conventions,
grammars belong to standalone projects and parsers are distributed by the
host editor's tooling.

## Features

- **Filetype detection** for `*.ql` / `*.qll` (Lua autocmds — coc.nvim does
  not implement VSCode's `contributes.languages` detection)
- **Language configuration**: `//` comment string, block comment
  continuation, `formatoptions`
- **Tree-sitter highlighting & folding** via `vim.treesitter.start()` for
  the `ql` language, using whatever parser and queries your editor has
  installed (see below)

## Requirements

- neovim ≥ 0.9 (developed and tested on 0.12)
- coc.nvim ≥ 0.0.82
- the `ql` tree-sitter parser, installed through the tree-sitter ecosystem:

```vim
:TSInstall ql
```

> nvim-treesitter registers the [tree-sitter-ql](https://github.com/samlanning/tree-sitter-ql)
> grammar and ships its queries. Note: the revision currently pinned in
> nvim-treesitter's lockfile mis-parses `true()`/`false()` (QL has no
> boolean literals); the fixed fork lives at
> [tree-sitter-ql (fork)](https://github.com/samlanning/tree-sitter-ql) —
> see that repo's README for installing it manually.

## Install (development)

```sh
# 1) register the extension with coc
python3 - <<'EOF'
import json, pathlib
p = pathlib.Path("~/.config/coc/extensions/package.json").expanduser()
pkg = json.loads(p.read_text())
pkg["dependencies"]["coc-codeql"] = "file:/data/dev/coc-codeql"
p.write_text(json.dumps(pkg, indent=2))
EOF
# 2) make node_modules/coc-codeql point at your working copy
ln -sfn /data/dev/coc-codeql ~/.config/coc/extensions/node_modules/coc-codeql
# 3) build
cd /data/dev/coc-codeql && pnpm install && pnpm build
```

Restart neovim and open a `.ql` file.

## How it works

The extension activates at startup (`activationEvents: ["*"]` — required,
since filetype detection itself is provided by this extension) and:

1. prepends its own directory to `runtimepath', exposing `lua/codeql.lua`;
2. runs `require('codeql').setup()` (via `nvim_exec2`; nvim 0.12 removed the
   `nvim_exec_lua` API) which registers filetype detection, applies the
   language configuration and calls `vim.treesitter.start(buf, 'ql')`,
   fixing up buffers loaded before activation.

If the parser is missing, the extension degrades gracefully and tells you
how to install it.

## Roadmap

- [ ] Language server (codeql query server) integration: diagnostics,
      completion, definitions
- [ ] `qlpack.yml` support
- [ ] Query runner / quick evaluation

## License

MIT
