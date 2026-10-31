# dsh-sidebar-sections

Collapsible section headers for the DeepSeek Harness sidebar. The sidebar is cut into three labelled
rows — **Panels**, **Workspace** and **Status** — and each one folds with a single click.

| Section | Host element | What it holds |
| --- | --- | --- |
| Panels | `nav._panelList` | Plugins / Plugin Market / Scheduled tasks / MCP connectors / More |
| Workspace | `div._regionArea` | the `Tasks | Channels | Scheduled` tabs and the session + workspace list |
| Status | `div._footerActions` inside `div._footArea` | Remote entry, OpenCode GO usage |

The default is *Workspace only*: open the app and the workspace list is the only thing expanded.

The settings row (`div._settingsArea`: the call button and your account avatar) is **never** folded and
is pinned to the very bottom of the sidebar, so it does not move when sections open or close.

## Install

```sh
dsh plugin --profile web add "https://github.com/LeeScenic/dsh-sidebar-sections/releases/latest/download/dsh-sidebar-sections-1.0.3.tgz"
```

Desktop profile: `dsh plugin --profile desktop add "https://github.com/LeeScenic/dsh-sidebar-sections/releases/latest/download/dsh-sidebar-sections-1.0.3.tgz"`.

Fully quit and reopen DSH after installing — client bundles are loaded at start-up.

## How it works

Client-only plugin (`dsh.client.platform = "web"`). It registers no slot and does not touch the React
tree:

1. Sections are located by CSS Modules **class suffix** (`[class*="_regionArea"]` plus an exact
   `(^|\s)[A-Za-z0-9_-]*_<suffix>(\s|$)` test), never by the build hash — a host upgrade that changes
   the hash keeps working.
2. Folding is a `data-dsh-sc-<key>` attribute on `<html>` plus one `!important` CSS rule, so a React
   re-render cannot restore a hidden section.
3. The header rows can themselves be dropped by a re-render, so a `MutationObserver` (rAF-debounced)
   plus a 1500 ms safety timer puts them back.
4. In the collapsed rail (`clientWidth < 96`) the header rows hide themselves instead of squeezing
   into a vertical stack.
5. Everything is wrapped in try/catch: a failure only `console.warn`s and never breaks the sidebar.

## State

Stored in `localStorage["dsh-sidebar-sections:v3"]`, e.g. `{"panels":true,"region":false,"foot":true}`
(`true` = folded).

Known limitation: the DSH desktop app picks a new port on every start, so the origin changes and the
previous state cannot be read back — the defaults apply again. The defaults *are* "workspace only",
so the practical effect is small.

## Compatibility

DSH `0.2.1-rc.3` — `0.2.1-rc.5`, web and desktop. Requires nothing from the host beyond the sidebar's
CSS Modules class names, which are matched by suffix.

## Files

| File | Purpose |
| --- | --- |
| `lib/client.js` | browser half — all of the behaviour |
| `lib/index.js` | host half — empty `apply()`, only so the entry shows up in the Loader graph |
| `cordis.patch.yml` | bundle patch, inserts the plugin row (pure addition, with a double-mount guard) |
| `dsh.plugin.json` | plugin manifest |

## License

MIT
