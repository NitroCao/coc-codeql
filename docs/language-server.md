# CodeQL language server integration

Reference for how coc-codeql drives `codeql execute language-server`.
Facts below were established against CLI **2.27.0** by raw stdio
JSON-RPC probing, by reading the shipped bytecode
(`com.semmle.frontend.server.*` in `tools/codeql.jar`), and by the
end-to-end tests in `test/`.

## Server

```sh
codeql execute language-server --check-errors ON_CHANGE|EXPLICIT
```

- LSP over stdio (Content-Length framed JSON-RPC on stdin/stdout).
- Older CLI releases used the subcommand `executeLanguageServer`.
- `--search-path` exists but is not needed: the server discovers
  qlpacks recursively under the workspace folders sent at
  `initialize` and resolves dependencies through the pack cache
  (`~/.codeql/packages`, populated by `codeql pack install`). Run
  `codeql pack install` in your qlpack once.
- `--synchronous` exists for debugging; not used here.

### Capabilities (from `initialize`)

| Capability | Notes |
| --- | --- |
| diagnostics | pushed on change (ON_CHANGE mode); qlpack.yml files get published too |
| completion | trigger characters `.` and `,`; member + import completion |
| hover | markdown; predicate signature + doc comment |
| definition | jumps into the pack cache (`.qll` files) |
| references / documentHighlight / documentSymbol | |
| formatting (document + range) | |
| rename (+ prepareRename) | |
| inlayHint | |
| signatureHelp, codeAction, codeLens | |
| workspace folders | `supported: true, changeNotifications: true` |
| experimental | `checkErrorsProvider`, `guessLocationProvider` (both advertised unconditionally; see below) |

### Custom protocol surface

Beyond standard LSP, the server speaks:

- `textDocument/codeQLDidChangeVisibleFiles` (client → server,
  notification) — sent by vscode-codeql when visible editors change.
  **Not required**: diagnostics, completion, hover and definition all
  work without it; not implemented here.
- `semmle/workspace/guessLocation` (client → server, request) — used
  by upstream to "guess the qlpack for this file"; not implemented
  here.
- `qlDidLoadConfiguration` (server → client, notification) — fired
  after `workspace/didChangeConfiguration` is processed; carries
  `ConfigurationLoadErrors`.

The server dynamically registers `workspace/didChangeWatchedFiles`
(requires the client to advertise the capability) and watches
`qlpack.yml`, `codeql-pack.yml`, `codeql-workspace.yml`,
`.codeqlmanifest.json`, `.dbscheme`, `*.ql`, `*.qll`.

### Protocol requirements

1. **`initialize.workspaceFolders` is mandatory.** With only `rootUri`,
   every import fails with `could not resolve module …`. coc's
   `LanguageClient` fills `workspaceFolders` from its workspace root
   detection natively — nothing to do on our side.
2. `initialize` must not be followed by an unknown-option spawn: the
   CLI rejects any extra arguments (see the `--stdio` pitfall below).

## Client wiring (src/lsp.ts)

```ts
const serverOptions: ServerOptions = async () => {
  serverProcess?.kill()
  serverProcess = spawnChild(cli, serverArgs())   // re-reads configuration
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
```

Design notes:

- **Function-form `ServerOptions`.** The extension spawns the server
  itself on every start. The static `{ command, args }` form has two
  problems: coc appends `--stdio` for explicit stdio transports, which
  the codeql CLI rejects (`Unknown option: '--stdio'`, crash-looping
  the client); and static args would be frozen at activation, so
  `codeql.languageServer.checkErrors` could never take effect across a
  restart. The function form avoids both; coc consumes the child's
  stdin/stdout directly. The child is killed on disposal.
- **documentSelector** matches vscode-codeql's, plus
  `**/codeql-workspace.yml` (upstream lists only qlpack.yml and
  codeql-pack.yml).
- The server is spawned eagerly at activation. coc's service-wrapper
  state shown in `:CocList services` still reads `initial` until the
  first matching buffer opens — a display quirk of coc, not the actual
  process state.

## Configuration semantics

- `codeql.cliPath` — `"codeql"` (default) or a path. Resolved via
  `exepath` once at activation; if missing, a warning is shown and the
  LSP features are disabled (editor features remain). Changing it
  requires `:CocRestart`.
- `codeql.languageServer.enable` — `true` (default) / `false`. When
  `false`, no client and no commands are registered; editor features
  remain. Read at activation.
- `codeql.languageServer.checkErrors` — `"ON_CHANGE"` (default) /
  `"EXPLICIT"`, passed as `--check-errors`. Re-read on every server
  start (activation and `codeql.restartLanguageServer`); see below.

### `checkErrors` — what the values actually do

Established from the CLI bytecode and covered by
`test/explicit-mode.test.ts`:

- `ON_CHANGE` — the server constructs an `AsynchronousDiagnosticReporter`
  that compiles changed QL files in the background and pushes
  `textDocument/publishDiagnostics`. Live diagnostics.
- `EXPLICIT` — the reporter is never created, and **no diagnostics are
  published at all**. Despite the advertised
  `experimental.checkErrorsProvider: true` capability, this protocol
  generation has no request that triggers checks on demand — the flag
  is vestigial. Practical use: silence diagnostics on slow machines or
  huge workspaces while keeping completion/hover/definition (those
  still compile on demand).

## Commands

| Command | Effect |
| --- | --- |
| `codeql.restartLanguageServer` | Stop + start the server; re-reads `checkErrors`. |

## Out of scope

- Query execution, quick evaluation, results/BQRS inspection — the
  *query server* (`codeql execute query-server2`), a separate JSON-RPC
  protocol, not LSP.
- `.qltest` running and test-output acceptance.
