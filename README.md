<p align="center">
	<a href="#english">English</a>&nbsp;&nbsp;|&nbsp;&nbsp;
	<a href="#%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87">简体中文</a>
</p>

<br>

# DSH Markdown Previewer / DSH Markdown 预览器

<p align="center">
	<b>DSH web GUI client plugin: sidebar Markdown preview — browse, render, edit &amp; save.</b><br>
	<b>DSH web GUI 客户端插件：侧栏 Markdown 预览 —— 浏览、渲染、编辑与保存。</b>
</p>

---

## English

A client plugin for the DSH web GUI: adds an "MD preview" button at the bottom of the sidebar. Clicking it opens a floating preview window where you can browse, render, and **edit & save** Markdown files.

### Features

- Directory browsing: lists subdirectories and `.md` files; enter a directory / open a file by clicking, `..` to go up;
- Dual view — rendered / source (built-in zero-dependency Markdown renderer: headings, lists, tables, code blocks, quotes, links, inline styles);
- **Editable source view**: save via the "Save" button or `Ctrl/Cmd+S`; unsaved changes are flagged in the title bar; switching files / closing the window asks for confirmation;
- Save with **mtime conflict detection**: if the file changed on disk in the meantime, you get a 409 prompt to refresh instead of a silent overwrite;
- Path input: type any absolute path (directory or `.md` file) and press Enter to jump;
- **Custom backdrop**: solid color, local image (auto canvas-compressed above 1.5 MB) or local video (≤ 50 MB, tiled as a muted looping `<video>` background, current page session only);
- **Custom text color**: pick the body text color in the backdrop panel; when unset, light/dark is derived from backdrop luminance; applies to body, lists, and the editor — not just headings;
- Image/color backdrop persisted in `localStorage`, with a one-click "restore theme default";
- Draggable title bar; double-click to reset to the default dock (position remembered in `sessionStorage`);
- Opens the current session's workspace directory by default; Esc or ✕ closes; refresh button re-reads the file.

### Security boundaries

- The host half registers only `/md-preview`-prefixed routes; read/list are GET/HEAD only, write is POST only;
- File access is limited to `.md` / `.markdown` / `.mdown` extensions, content ≤ 2 MB; write request body ≤ 3 MB;
- Writes go through **temp file + rename** atomic replacement — an interrupted write never leaves a half file;
- Writes carry **mtime conflict detection** (409) to prevent clobbering unsynchronized external edits;
- Directory listings show only directories and md files;
- Accessible paths = whatever the local shell can read/write (the GUI listens on 127.0.0.1 by default).

### Files

| File | Role |
| --- | --- |
| `package.json` | Package manifest + `dsh.bundle` (install layer) + `dsh.client` (browser-half discovery) |
| `cordis.patch.yml` | Bundle patch layer activated by `dsh plugin add`; registers the `md-preview` Loader row |
| `index.js` | Host half (node): `/md-preview/read`, `/md-preview/list`, `/md-preview/write` routes |
| `client.js` | Browser half (classic script bundle, no build step) |

### Install

Install the official runtime with Node.js:

```sh
npx @deepseek-ai/dsh web
```

Install this plugin into a profile (the ecosystem convention):

```sh
dsh plugin --profile web add "github:anitman/dsh-plugin-md-preview#ref"
```

`dsh plugin` forwards package operations to pnpm, so npm, Git/GitHub, local path, `file:` and `link:` package specs are all supported — e.g. from a local clone:

```sh
dsh plugin --profile web add .
```

Only packages declaring `dsh.bundle.patch` become active profile layers; this package declares it, so `dsh plugin add` completes the link and layer activation in one step. Pure JS, no build scripts — a git install needs **no** `allowBuilds` approval.

**Restart `dsh --profile web`** after installing or updating a bundle: the document icon button then appears at the bottom of the sidebar (above the settings button); manage it under **Settings → Plugins**.

#### Uninstall

```sh
dsh plugin --profile web remove dsh-plugin-md-preview
```

Removes the dependency and the patch layer together; restart dsh to take effect.

#### Manual fallback (without the dsh CLI)

1. Create a symlink `dsh-plugin-md-preview` in `~/.dsh/profiles/web/node_modules/` pointing at this directory (or copy the directory if symlinks fail);
2. Add to `dependencies` in `~/.dsh/profiles/web/package.json`: `"dsh-plugin-md-preview": "file:<absolute path to this repo>"`;
3. Append to the top-level array of `~/.dsh/profiles/web/cordis.patch.yml`:
   ```yaml
   - insert:
       - id: md-preview
         name: "dsh-plugin-md-preview"
   ```
4. **Restart the dsh process** (new Loader rows are only scanned at startup; sessions restore automatically).

### Updating

- Only `client.js` changed: no restart needed, client-HMR hot-reloads the plugin (requires the host-side watch chain to be active; otherwise refresh the page);
- `index.js` (host half) changed: dsh restart required;
- Local clone installed via `add .`: `git pull`, then restart dsh;
- Installed via `github:`: re-run the install command with a new `#ref` to upgrade;
- If node_modules holds a copy instead of a symlink: re-copy after changes (or switch back to a symlink).

---

## 简体中文

DSH web GUI 客户端插件：侧栏底部多一个「MD 预览」按钮，点开是一个浮动预览窗口，可直接浏览、渲染并**编辑保存** Markdown 文件。

### 功能

- 目录浏览：列出子目录和 `.md` 文件，点击进入 / 点击文件打开，`..` 回上级；
- 渲染 / 源码双视图（内置零依赖 Markdown 渲染器：标题、列表、表格、代码块、引用、链接、行内样式）；
- **源码视图可编辑**：点「保存」或按 `Ctrl/Cmd+S` 写回磁盘；有未保存修改时标题栏显示「保存 ●」，切换文件 / 关窗前会弹确认；
- 保存带 **mtime 冲突检测**：若期间文件被外部改过，返回 409 提示刷新后重试，避免误覆盖；
- 路径输入框：直接输入任意绝对路径（目录或 .md 文件）回车跳转；
- **自定义背景**：标题栏「背景」按钮可选纯色、本地图片（>1.5MB 自动 canvas 压缩）或本地视频（≤50MB，`<video>` 铺底循环静音播放，仅当前页面会话有效）；
- **自定义文字颜色**：背景面板里可选正文文字色，不设则按背景亮度自动取深浅；作用范围覆盖正文 / 列表 / 编辑区，不只标题；
- 图片/颜色背景存 `localStorage`，可「恢复主题默认」一键还原；
- 标题栏可拖动，双击复位到默认停靠位（位置记忆在 `sessionStorage`）；
- 默认打开当前会话的工作区目录；Esc 或 ✕ 关闭；刷新按钮重读文件。

### 安全边界

- 宿主半边只注册 `/md-preview` 前缀路由；read/list 仅 GET/HEAD，write 仅 POST；
- 读/写文件都只允许 `.md` / `.markdown` / `.mdown` 扩展名，且内容 ≤ 2MB；write 请求体 ≤ 3MB；
- write 通过**临时文件 + rename** 原子替换，中断不会留下半截文件；
- write 带 **mtime 冲突检测**（409），防止覆盖未同步的外部修改；
- 列目录只显示目录与 md 文件；
- 路径可访问范围 = 本机 shell 可读写范围（GUI 默认只听 127.0.0.1）。

### 文件

| 文件 | 作用 |
| --- | --- |
| `package.json` | 包描述 + `dsh.bundle`（安装层声明）+ `dsh.client`（浏览器半边发现机制） |
| `cordis.patch.yml` | 组合包补丁层：由 `dsh plugin add` 激活，注册 `md-preview` Loader 行 |
| `index.js` | 宿主半边（node）：`/md-preview/read`、`/md-preview/list`、`/md-preview/write` 路由 |
| `client.js` | 浏览器半边（classic script bundle，无需构建） |

### 安装

用 Node.js 安装官方运行时：

```sh
npx @deepseek-ai/dsh web
```

把本插件装进 profile（生态标准写法）：

```sh
dsh plugin --profile web add "github:anitman/dsh-plugin-md-preview#ref"
```

`dsh plugin` 把包操作转发给 pnpm，因此 npm、Git/GitHub、本地路径、`file:` 与 `link:` 包规范都支持——例如从本地 clone 安装：

```sh
dsh plugin --profile web add .
```

声明了 `dsh.bundle.patch` 的包才会成为激活的 profile 层；本包已声明，`dsh plugin add` 一步完成链接与补丁层激活。纯 JS 无构建脚本，git 安装**不需要** `allowBuilds` 授权。

**安装或更新后重启 `dsh --profile web`**：GUI 左侧栏底部（设置按钮上方）会出现文档图标按钮；管理入口在**设置 → 插件**。

#### 卸载

```sh
dsh plugin --profile web remove dsh-plugin-md-preview
```

同时移除依赖和补丁层，重启 dsh 生效。

#### 手动安装（fallback，无 dsh CLI 时）

1. 在 `~/.dsh/profiles/web/node_modules/` 下创建指向本目录的符号链接 `dsh-plugin-md-preview`（失败则直接拷贝本目录）；
2. 在 `~/.dsh/profiles/web/package.json` 的 `dependencies` 加：`"dsh-plugin-md-preview": "file:<本机此仓库的绝对路径>"`；
3. 在 `~/.dsh/profiles/web/cordis.patch.yml` 顶层数组追加：
   ```yaml
   - insert:
       - id: md-preview
         name: "dsh-plugin-md-preview"
   ```
4. **重启 dsh 进程**（新增 Loader 条目只在启动时扫描；会话会自动恢复）。

### 更新

- 只改 `client.js`：无需重启，client-HMR 会自动热重载插件（需要宿主侧 watch 链生效；否则刷新页面）；
- 改 `index.js`（宿主半边）：必须重启 dsh；
- 本地 clone 通过 `add .` 安装的：`git pull` 后重启 dsh；
- `github:` 安装的：用新的 `#ref` 重新执行安装命令升级；
- 若 node_modules 里是拷贝而非符号链接：修改后需重新拷贝（或改回符号链接）。