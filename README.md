# opencode-skills-sidebar

OpenCode TUI plugin that adds a `Skills` section to the right sidebar and shows which skills have been loaded in the current session.

## Installation

This plugin is a **TUI plugin**, so it must be configured in `~/.config/opencode/tui.json`, not in `opencode.json`.

### 1. Build the plugin

From this directory:

```bash
bun install
bun run build
```

That produces:

- `dist/tui.js`
- `dist/tui.d.ts`

### 2. Add it to OpenCode

Add the built file to `~/.config/opencode/tui.json`:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "theme": "system",
  "plugin": [
    "/Users/CTW03903/.config/opencode/plugins/opencode-skills-sidebar/dist/tui.js"
  ]
}
```

### 3. Restart OpenCode

Restart `opencode` so the TUI plugin is reloaded.

## What it does

- Adds a `Skills` section to the right sidebar
- Shows all skills visible to OpenCode for the current directory/session
- Marks each skill as `Loaded` or `Unloaded`
- Supports collapsing the section from the sidebar header
- Persists collapsed state across restarts
- Supports hiding individual skills from the sidebar (hidden set persists across restarts)

## Filtering skills

You can hide skills you do not want to see in the sidebar (for example, the
`caveman` skill). Manage hidden skills with **`/skills-filter`**:

- Opens a full-screen dialog. Each skill shows a `hidden` / `shown` footer;
  select one to toggle.
- A `Show all hidden` entry appears at the top of the list when any skill is
  hidden.
- When at least one skill is hidden, the expanded sidebar shows a
  `Hidden: … (show all)` footer — click it to restore everything.

When at least one skill is hidden, the collapsed sidebar header shows
`(N loaded, M hidden)`. The hidden set is stored under
`opencode-skills-sidebar.hidden` in the TUI plugin kv and survives restarts.

## How it works

The plugin uses the OpenCode TUI plugin API and registers content in the `sidebar_content` slot.

Main points:

- Skill discovery comes from OpenCode itself via `client.app.skills()`
- Loaded state is tracked from `message.part.updated` events for the built-in `skill` tool
- Sidebar placement is controlled by slot `order`
- Current order is `250`, which places it between built-in `MCP` (`200`) and `LSP` (`300`)

## Development

Build:

```bash
bun run build
```

Type-check only:

```bash
bun run typecheck
```
