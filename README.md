# DSH Markdown Previewer

**English** | [中文](README.zh.md)

A DSH web GUI client plugin: adds an "MD preview" button at the bottom of the sidebar. Clicking it opens a floating preview window where you can browse, render, and **edit & save** Markdown files.

## Features

- Directory browsing: lists subdirectories and `.md` files; enter a directory / open a file by clicking, `..` to go up;
- Dual view — rendered / source (built-in zero-dependency Markdown renderer: headings, lists, tables, code blocks, quotes, links, inline styles);
- **Editable source view**: save via the "Save" button or `Ctrl/Cmd+S`; unsaved changes are flagged in the title bar; switching files / closing the window asks for confirmation;
- Save with **mtime conflict detection**: if the file changed on disk in the meantime, you get a 409 prompt to refresh instead of a silent overwrite;
- Path input: type any absolute path (directory or `.md` file) and press Enter to jump;
- **Custom backdrop**: solid color, local image (auto canvas-compressed above 1.5 MB) or local video (≤ 50 MB, `<video>` tiled as a muted looping background, current page session only);
- **Custom text color**: pick the body text color in the backdrop panel; when unset, light/dark is derived from backdrop luminance; applies to body, lists, and the editor — not just headings;
- Image/color backdrop persisted in `localStorage`, with a one-click "restore theme default";
- Draggable title bar; double-click to reset to the default dock (position remembered in `sessionStorage`);
- Opens the current session's workspace directory by default; Esc or ✕ closes; refresh button re-reads the file.

## Security boundaries

- The host half registers only `/md-preview`-prefixed routes; read/list are GET/HEAD only, write is POST only;
- File access is limited to `.md` / `.markdown` / `.mdown` extensions, content ≤ 2 MB; write request body ≤ 3 MB;
- Writes go through **temp file + rename** atomic replacement — an interrupted write never leaves a half file;
- Writes carry **mtime conflict detection** (409) to prevent clobbering unsynchronized external edits;
- Directory listings show only directories and md files;
- Accessible paths = whatever the local shell can read/write (the GUI listens on 127.0.0.1 by default).

## Files

| File | Role |
| --- | --- |
| `package.json` | Package manifest + `dsh.bundle` (install layer) + `dsh.client` (browser-half discovery) |
| `cordis.patch.yml` | Bundle patch layer activated by `dsh plugin add`; registers the `md-preview` Loader row |
| `index.js` | Host half (node): `/md-preview/read`, `/md-preview/list`, `/md-preview/write` routes |
| `client.js` | Browser half (classic script bundle, no build step) |

## Installation (web profile, recommended)

The package declares `dsh.bundle`, so it installs the standard ecosystem way — one command handles linking, dependencies, and patch-layer registration:

```sh
# from GitHub (the ecosystem convention; pin a ref to protect against later pushes)
dsh plugin --profile web add github:anitman/dsh-plugin-md-preview#<sha-or-tag>
dsh plugin --profile web add github:anitman/dsh-plugin-md-preview

# or from a local clone (run inside the clone)
dsh plugin --profile web add .
```

This is a pure JS package with no build scripts, so a git install needs **no** `allowBuilds` approval.

**Restart the dsh process** after installing (new Loader rows are only scanned at startup; sessions restore automatically). The document icon button then appears at the bottom of the GUI sidebar (above the settings button).

### Uninstall

```sh
dsh plugin --profile web remove dsh-plugin-md-preview
```

Removes the dependency and the patch layer together; restart dsh to take effect.

## Manual fallback (without the dsh CLI)

1. Create a symlink `dsh-plugin-md-preview` in `~/.dsh/profiles/web/node_modules/`
   pointing at this directory (or copy the directory if symlinks fail);
2. Add to `dependencies` in `~/.dsh/profiles/web/package.json`:
   `"dsh-plugin-md-preview": "file:<absolute path to this repo on your machine>"`;
3. Append to the top-level array of `~/.dsh/profiles/web/cordis.patch.yml`:
   ```yaml
   - insert:
       - id: md-preview
         name: "dsh-plugin-md-preview"
   ```
4. **Restart the dsh process** (new Loader rows are only scanned at startup; sessions restore automatically).

## Updating

- Only `client.js` changed: no restart needed, client-HMR hot-reloads the plugin (requires the host-side watch chain to be active; otherwise refresh the page);
- `index.js` (host half) changed: dsh restart required;
- Local clone installed via `dsh plugin add .`: `git pull`, then restart dsh;
- Installed via `github:`: re-run `dsh plugin --profile web add github:anitman/dsh-plugin-md-preview#<sha>` to upgrade;
- If node_modules holds a copy instead of a symlink: re-copy after changes (or switch back to a symlink).