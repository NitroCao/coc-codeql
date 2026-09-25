--- CodeQL runtime support for coc-codeql.
---
--- This extension is pure editor integration: it provides filetype
--- detection, the language configuration and starts tree-sitter
--- highlighting. The parser itself is NOT bundled — that is the job of
--- the tree-sitter ecosystem:
---
---   :TSInstall ql   (nvim-treesitter registers the tree-sitter-ql
---                    grammar and ships its queries)
---
--- or a manual install, see :h treesitter-parsers.
---
--- Loaded by the coc extension through dofile() and exposed as the
--- global `coc_codeql` (setup() is idempotent, so it can be re-run).

local M = {}

local GROUP = 'coc_codeql'

local function start_highlight(buf)
  -- nvim-treesitter's highlight module may already have started
  if vim.treesitter.highlighter.active[buf] then
    return
  end
  local ok, err = pcall(vim.treesitter.start, buf, 'ql')
  if not ok then
    -- No notifying from lua: vim.notify is hooked by coc.nvim into a
    -- synchronous RPC handler, and any editor output from a scheduled
    -- callback can wedge the RPC channel of embedded editors. Record the
    -- failure; the extension's node side picks it up and warns through
    -- coc's own message channel.
    _G.coc_codeql_parser_error = tostring(err):gsub('\n.*', '')
  end
end

local function on_filetype(buf)
  if vim.bo[buf].buftype ~= '' then
    return
  end

  --- language configuration (was language-configuration.json in the
  --- vscode extension): line comments, comment continuation, auto-wrap
  vim.bo[buf].commentstring = '// %s'
  vim.bo[buf].comments = 'sO:*. -,mO:*.  ,exO:*/,s1:/*,mb:*,ex:*/,://'
  local fo = vim.bo[buf].formatoptions:gsub('t', '')
  for _, flag in ipairs({ 'c', 'r', 'o', 'q', 'l' }) do
    if not fo:find(flag, 1, true) then
      fo = fo .. flag
    end
  end
  vim.bo[buf].formatoptions = fo

  -- Started from a timer: launching the highlighter inside the
  -- FileType autocmd wedges nvim's embed channel (see test notes).
  vim.fn.timer_start(50, function() start_highlight(buf) end)
end

function M.setup()
  local group = vim.api.nvim_create_augroup(GROUP, { clear = true })

  -- filetype detection: nvim has no built-in detection for CodeQL
  vim.api.nvim_create_autocmd({ 'BufReadPost', 'BufNewFile' }, {
    group = group,
    pattern = { '*.ql', '*.qll' },
    callback = function(args)
      if vim.bo[args.buf].filetype == '' then
        vim.bo[args.buf].filetype = 'ql' -- fires FileType below
      end
    end,
  })

  vim.api.nvim_create_autocmd('FileType', {
    group = group,
    pattern = 'ql',
    callback = function(args)
      on_filetype(args.buf)
    end,
  })

  -- fix up buffers that were loaded before setup() ran
  for _, buf in ipairs(vim.api.nvim_list_bufs()) do
    if vim.api.nvim_buf_is_loaded(buf) and vim.bo[buf].buftype == '' then
      local name = vim.api.nvim_buf_get_name(buf)
      if vim.bo[buf].filetype == '' and name:match('%.qll?$') then
        vim.bo[buf].filetype = 'ql'
      elseif vim.bo[buf].filetype == 'ql' then
        on_filetype(buf)
      end
    end
  end
end

return M
