import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ServiceStat, diagnosticManager, services, workspace } from 'coc.nvim'

export const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))

/** Root of the extension repository (coc-test runs with cwd = repo root). */
export const ROOT = process.cwd()

export async function bufVar<T = unknown>(
  buf: number,
  name: string,
): Promise<T> {
  return workspace.nvim.call('getbufvar', [buf, name])
}

/** Open a file in the current window and return its buffer number. */
export async function openFile(file: string): Promise<number> {
  await workspace.nvim.command(`edit ${file}`)
  return workspace.nvim.call('bufnr', ['%'])
}

/** Wait until the `codeql` service reports the given state; throws on timeout. */
export async function waitServiceState(
  state: ServiceStat,
  timeoutMs = 30_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (services.getService('codeql')?.state === state) return
    await sleep(250)
  }
  throw new Error(
    `codeql service did not reach state ${ServiceStat[state]} within ${timeoutMs} ms`,
  )
}

export interface DiagnosticItem {
  file: string
  source: string
  severity: string
  message: string
}

/**
 * Poll coc's diagnostic list until at least one diagnostic for `file`
 * appears (any source). Returns the matching diagnostics.
 *
 * Uses the node-side `diagnosticManager.getDiagnosticList()` API on purpose:
 * the round trip through `coc#rpc#request` makes nvim fire a synchronous
 * RPC back into the node server, which can mutually block (and wedge the
 * RPC channel of embedded editors) while requests are in flight.
 */
export async function waitDiagnosticsFor(
  file: string,
  timeoutMs = 20_000,
): Promise<DiagnosticItem[]> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const all = (await diagnosticManager.getDiagnosticList()) as unknown as DiagnosticItem[]
    const forFile = all.filter(d => d.file === file)
    if (forFile.length > 0) return forFile
    await sleep(500)
  }
  return []
}

/**
 * Locate a `ql` tree-sitter parser + queries for the highlighting tests.
 * Honors COC_CODEQL_PARSER_DIR, then falls back to the user's nvim site
 * directory. Returns undefined when no parser is available.
 */
export function findParserDir(): string | undefined {
  const candidates = [
    process.env.COC_CODEQL_PARSER_DIR,
    path.join(os.homedir(), '.local/share/nvim/site'),
  ].filter(Boolean) as string[]
  for (const dir of candidates) {
    if (
      fs.existsSync(path.join(dir, 'parser', 'ql.so')) &&
      fs.existsSync(path.join(dir, 'queries', 'ql', 'highlights.scm'))
    ) {
      return dir
    }
  }
  return undefined
}

/** `true` when the CodeQL CLI is resolvable in this environment. */
export async function hasCodeqlCli(): Promise<boolean> {
  const resolved: string = await workspace.nvim.call('exepath', ['codeql'])
  return resolved !== ''
}
