# DSH Markdown 预览器

[English](README.md) | **中文**

DSH web GUI 客户端插件：侧栏底部多一个「MD 预览」按钮，点开是一个浮动预览窗口，可直接浏览、渲染并**编辑保存** Markdown 文件。

## 功能

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

## 安全边界

- 宿主半边只注册 `/md-preview` 前缀路由；read/list 仅 GET/HEAD，write 仅 POST；
- 读/写文件都只允许 `.md` / `.markdown` / `.mdown` 扩展名，且内容 ≤ 2MB；write 请求体 ≤ 3MB；
- write 通过**临时文件 + rename** 原子替换，中断不会留下半截文件；
- write 带 **mtime 冲突检测**（409），防止覆盖未同步的外部修改；
- 列目录只显示目录与 md 文件；
- 路径可访问范围 = 本机 shell 可读写范围（GUI 默认只听 127.0.0.1）。

## 文件

| 文件 | 作用 |
| --- | --- |
| `package.json` | 包描述 + `dsh.bundle`（安装层声明）+ `dsh.client`（浏览器半边发现机制） |
| `cordis.patch.yml` | 组合包补丁层：安装时由 `dsh plugin add` 激活，注册 `md-preview` Loader 行 |
| `index.js` | 宿主半边（node）：`/md-preview/read`、`/md-preview/list`、`/md-preview/write` 路由 |
| `client.js` | 浏览器半边（classic script bundle，无需构建） |

## 安装（web profile，推荐）

本包声明了 `dsh.bundle`，按生态标准机制一条命令安装（自动完成链接、依赖与补丁层注册）：

```sh
# 从 GitHub 安装（生态惯例；锁定 ref 可防后续推送改动代码）
dsh plugin --profile web add github:anitman/dsh-plugin-md-preview#<sha或tag>
dsh plugin --profile web add github:anitman/dsh-plugin-md-preview

# 或从本地 clone 安装（在 clone 目录内执行）
dsh plugin --profile web add .
```

纯 JS 包无构建脚本，git 安装**不需要** `allowBuilds` 授权。

安装后**重启 dsh 进程**（新增 Loader 条目只在启动时扫描；会话会自动恢复），GUI 左侧栏底部（设置按钮上方）会出现一个文档图标按钮。

### 卸载

```sh
dsh plugin --profile web remove dsh-plugin-md-preview
```

同时移除依赖和补丁层，重启 dsh 生效。

## 手动安装（fallback，无 dsh CLI 时）

1. 在 `~/.dsh/profiles/web/node_modules/` 下创建指向本目录的符号链接
   `dsh-plugin-md-preview`（失败则直接拷贝本目录）；
2. 在 `~/.dsh/profiles/web/package.json` 的 `dependencies` 加：
   `"dsh-plugin-md-preview": "file:<本机此仓库的绝对路径>"`；
3. 在 `~/.dsh/profiles/web/cordis.patch.yml` 顶层数组追加：
   ```yaml
   - insert:
       - id: md-preview
         name: "dsh-plugin-md-preview"
   ```
4. **重启 dsh 进程**（新增 Loader 条目只在启动时扫描；会话会自动恢复）。

## 更新

- 只改 `client.js`：无需重启，client-HMR 会自动热重载插件（需要宿主侧的 watch 链生效；否则刷新页面）；
- 改 `index.js`（宿主半边）：必须重启 dsh；
- `dsh plugin add .` 链接的本机 clone：`git pull` 后重启 dsh 即可；
- `github:` 安装的：重新执行 `dsh plugin --profile web add github:anitman/dsh-plugin-md-preview#<sha>` 升级；
- 若 node_modules 里是拷贝而非符号链接：修改后需重新拷贝（或改回符号链接）。