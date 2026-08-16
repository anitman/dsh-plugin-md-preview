/**
 * dsh-plugin-md-preview — 浏览器半边（client bundle，classic script）。
 *
 * 侧栏底部「MD 预览」按钮 + 浮动预览窗口：
 *   - 目录浏览（/md-preview/list，只列子目录与 .md 文件）；
 *   - Markdown 渲染 / 源码双视图（/md-preview/read，2MB 上限）；
 *   - 源码视图可编辑，Ctrl/Cmd+S 或「保存」按钮写回（POST /md-preview/write，
 *     宿主端带 mtime 冲突检测与原子替换）；
 *   - 绝对路径输入框直接跳转；默认打开当前会话工作区目录；
 *   - 标题栏可拖动（双击复位到默认停靠位，位置记忆在 sessionStorage）；
 *   - 有未保存修改时，切文件/关窗前确认；Esc 或 ✕ 关闭。
 *
 * 只依赖平台种子模块（react / react/jsx-runtime / react-dom），
 * 不引入任何 npm 包，因此无需构建步骤。
 * 颜色/字体全部使用 DSW 主题 token（定义在 body 上，portal 可继承）。
 */
window.__ModuleLoader__.load({
	id: "dsh-plugin-md-preview",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let jsxrt = require("react/jsx-runtime");
		let reactDom = require("react-dom");
		const { useState, useEffect, useRef, useCallback } = react;
		const { jsx, jsxs, Fragment } = jsxrt;

		/* ── 样式（按 data-plugin 约定注入，HMR 重载时由宿主按 data-plugin 清除） ── */
		const css = [
			".mdpv-btn{width:28px;height:28px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:8px;justify-content:center;align-items:center;padding:0;display:inline-flex;cursor:pointer}",
			".mdpv-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
			".mdpv-btn-active{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}",
			".mdpv-panel{position:fixed;top:12px;right:12px;bottom:12px;width:640px;max-width:calc(100vw - 24px);z-index:2000;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;display:flex;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;box-shadow:var(--dsw-shadow-lv3);font-family:var(--dsw-font-family);font-size:13px}",
			".mdpv-panel-video{overflow:hidden}",
			".mdpv-video{position:absolute;top:0;right:0;bottom:0;left:0;width:100%;height:100%;object-fit:cover;z-index:0;pointer-events:none}",
			".mdpv-video-scrim{position:absolute;top:0;right:0;bottom:0;left:0;z-index:0;pointer-events:none;background:linear-gradient(rgba(0,0,0,0.4),rgba(0,0,0,0.4))}",
			".mdpv-panel-video>*:not(.mdpv-video):not(.mdpv-video-scrim):not(.mdpv-head){position:relative;z-index:1}",
			".mdpv-panel-video>.mdpv-head{position:relative;z-index:2}",
			".mdpv-head{flex:none;justify-content:flex-start;align-items:center;gap:8px;display:flex;cursor:move;user-select:none;touch-action:none}",
			".mdpv-title{font-size:13px;font-weight:600;flex:none}",
			".mdpv-file{flex:1;min-width:0;color:var(--dsw-alias-label-tertiary);white-space:nowrap;text-overflow:ellipsis;overflow:hidden;font-size:12px}",
			".mdpv-note{flex:none;color:var(--dsw-alias-state-success-primary);font-size:12px;white-space:nowrap}",
			".mdpv-head-actions{flex:none;gap:4px;display:inline-flex}",
			".mdpv-bgwrap{position:relative;flex:none;display:inline-flex}",
			".mdpv-bgpick{position:absolute;top:calc(100% + 6px);right:0;z-index:2001;flex-direction:column;gap:6px;padding:10px;min-width:200px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;box-shadow:var(--dsw-shadow-lv3);cursor:grab;user-select:none;display:flex}",
			".mdpv-bgpick:active{cursor:grabbing}",
			".mdpv-bgpick-row{gap:8px;align-items:center;display:flex}",
			".mdpv-bgpick-label{flex:1;font-size:12px;color:var(--dsw-alias-label-secondary)}",
			".mdpv-color{width:40px;height:26px;padding:0;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:0 0;cursor:pointer}",
			".mdpv-bgpick-err{font-size:12px;color:var(--dsw-alias-state-error-primary)}",
			".mdpv-bgpick-msg{font-size:12px;color:var(--dsw-alias-label-secondary)}",
			".mdpv-seg{cursor:pointer;border:1px solid var(--dsw-alias-border-l2);background:0 0;border-radius:6px;padding:2px 8px;font-size:12px;font-family:inherit;color:var(--dsw-alias-label-secondary)}",
			".mdpv-seg:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
			".mdpv-seg:disabled{cursor:default;opacity:.4}",
			".mdpv-seg-active{background:var(--dsw-alias-brand-primary);border-color:transparent;color:var(--dsw-alias-label-primary-inverted)}",
			".mdpv-pathbar{flex:none;gap:6px;display:flex}",
			".mdpv-input{flex:1;min-width:0;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:5px 8px;font:inherit;font-size:12px}",
			".mdpv-body{flex:1;min-height:0;overflow:auto;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:10px 12px}",
			".mdpv-body-edit{display:flex;flex-direction:column;padding:0}",
			".mdpv-edit{flex:1;width:100%;min-height:0;box-sizing:border-box;border:none;outline:0;resize:none;background:0 0;color:var(--mdpv-text,var(--dsw-alias-label-primary));padding:10px 12px;font-family:var(--dsw-font-markdown-code-block-font-family);font-size:var(--dsw-font-markdown-code-block-font-size);line-height:var(--dsw-font-markdown-code-block-line-height);white-space:pre-wrap;word-break:break-word;display:block}",
			".mdpv-status{color:var(--dsw-alias-label-tertiary);line-height:20px}",
			".mdpv-error{color:var(--dsw-alias-state-error-primary)}",
			".mdpv-crumbs{color:var(--dsw-alias-label-tertiary);white-space:nowrap;text-overflow:ellipsis;overflow:hidden;margin-bottom:6px;font-size:12px}",
			".mdpv-row{width:100%;cursor:pointer;gap:8px;align-items:center;background:0 0;border:none;border-radius:6px;padding:4px 8px;font:inherit;font-size:13px;color:var(--mdpv-text,var(--dsw-alias-label-primary));text-align:left;display:flex}",
			".mdpv-row:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".mdpv-row-icon{flex:none;width:18px;text-align:center}",
			".mdpv-row-label{min-width:0;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}",
			".mdpv-md{line-height:var(--dsw-font-markdown-base-line-height);font-family:var(--dsw-font-markdown-base-font-family);font-size:var(--dsw-font-markdown-base-font-size);color:var(--mdpv-text,var(--dsw-alias-label-primary));word-break:break-word}",
			".mdpv-md h1{margin:14px 0 8px;font-family:var(--dsw-font-markdown-h1-font-family);font-size:var(--dsw-font-markdown-h1-font-size);font-weight:var(--dsw-font-markdown-h1-font-weight);line-height:var(--dsw-font-markdown-h1-line-height)}",
			".mdpv-md h2{margin:14px 0 8px;font-family:var(--dsw-font-markdown-h2-font-family);font-size:var(--dsw-font-markdown-h2-font-size);font-weight:var(--dsw-font-markdown-h2-font-weight);line-height:var(--dsw-font-markdown-h2-line-height)}",
			".mdpv-md h3{margin:12px 0 6px;font-family:var(--dsw-font-markdown-h3-font-family);font-size:var(--dsw-font-markdown-h3-font-size);font-weight:var(--dsw-font-markdown-h3-font-weight);line-height:var(--dsw-font-markdown-h3-line-height)}",
			".mdpv-md h4{margin:10px 0 6px;font-family:var(--dsw-font-markdown-h4-font-family);font-size:var(--dsw-font-markdown-h4-font-size);font-weight:var(--dsw-font-markdown-h4-font-weight);line-height:var(--dsw-font-markdown-h4-line-height)}",
			".mdpv-md p{margin:8px 0}",
			".mdpv-md code{background:var(--dsw-alias-bg-layer-2);border-radius:4px;padding:1px 5px;font-size:12.5px;font-family:var(--dsw-font-markdown-code-font-family)}",
			".mdpv-md pre{background:var(--dsw-alias-bg-layer-2);border-radius:8px;padding:10px 12px;overflow:auto;margin:10px 0}",
			".mdpv-md pre code{background:0 0;padding:0;font-size:var(--dsw-font-markdown-code-block-font-size);font-family:var(--dsw-font-markdown-code-block-font-family);line-height:var(--dsw-font-markdown-code-block-line-height)}",
			".mdpv-md blockquote{margin:8px 0;padding:2px 12px;border-left:3px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary)}",
			".mdpv-md table{border-collapse:collapse;margin:10px 0;width:100%}",
			".mdpv-md th,.mdpv-md td{border:1px solid var(--dsw-alias-border-l1);padding:4px 10px;text-align:left}",
			".mdpv-md th{background:var(--dsw-alias-bg-layer-2)}",
			".mdpv-md hr{border:none;border-top:1px solid var(--dsw-alias-border-l2);margin:14px 0}",
			".mdpv-md img{max-width:100%}",
			".mdpv-md a{color:var(--dsw-alias-brand-text)}"
		].join("\n");
		const tagId = "dsh-plugin-md-preview/app.css";
		if (typeof document !== "undefined" && document.querySelector('style[data-plugin-css="' + tagId + '"]') === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-plugin-md-preview";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}

		/* ── 零依赖紧凑 Markdown 渲染器 ── */
		function esc(s) {
			return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
		}
		function inline(src) {
			const codes = [];
			let s = esc(src);
			s = s.replace(/`([^`]+)`/g, (m, c) => {
				codes.push(c);
				return "\u0000" + (codes.length - 1) + "\u0000";
			});
			s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img alt="$1" src="$2">');
			s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
			s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noreferrer">$2</a>');
			s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
			s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
			s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
			return s.replace(/\u0000(\d+)\u0000/g, (m, i) => "<code>" + codes[+i] + "</code>");
		}
		function buildList(items) {
			let html = "";
			const stack = [];
			for (const it of items) {
				while (
					stack.length &&
					(it.indent < stack[stack.length - 1].indent ||
						(it.indent === stack[stack.length - 1].indent && it.ordered !== stack[stack.length - 1].ordered))
				) {
					const t = stack.pop();
					html += t.openLi ? "</li>" : "";
					html += t.ordered ? "</ol>" : "</ul>";
				}
				const top = stack[stack.length - 1];
				if (!top || it.indent > top.indent) {
					stack.push({ indent: it.indent, ordered: it.ordered, openLi: true });
					html += (it.ordered ? "<ol>" : "<ul>") + "<li>" + inline(it.text);
				} else {
					html += top.openLi ? "</li>" : "";
					html += "<li>" + inline(it.text);
					top.openLi = true;
				}
			}
			while (stack.length) {
				const t = stack.pop();
				html += t.openLi ? "</li>" : "";
				html += t.ordered ? "</ol>" : "</ul>";
			}
			return html;
		}
		const LIST_RE = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
		function renderMarkdown(src) {
			const lines = String(src ?? "").replace(/\r\n?/g, "\n").split("\n");
			const out = [];
			let i = 0;
			while (i < lines.length) {
				const line = lines[i];
				if (/^\s*$/.test(line)) { i++; continue; }
				const fence = line.match(/^\s*(`{3,}|~{3,})\s*(\S+)?\s*$/);
				if (fence) {
					const marker = fence[1][0];
					const minLen = fence[1].length;
					const lang = fence[2] || "";
					const buf = [];
					i++;
					while (i < lines.length) {
						const cm = lines[i].match(/^\s*(`{3,}|~{3,})\s*$/);
						if (cm && cm[1][0] === marker && cm[1].length >= minLen) { i++; break; }
						buf.push(lines[i]);
						i++;
					}
					out.push("<pre><code" + (lang ? ' class="lang-' + esc(lang) + '"' : "") + ">" + esc(buf.join("\n")) + "</code></pre>");
					continue;
				}
				const h = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
				if (h) { const n = h[1].length; out.push("<h" + n + ">" + inline(h[2]) + "</h" + n + ">"); i++; continue; }
				if (/^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push("<hr>"); i++; continue; }
				if (/^\s{0,3}>/.test(line)) {
					const buf = [];
					while (i < lines.length && /^\s{0,3}>/.test(lines[i])) {
						buf.push(lines[i].replace(/^\s{0,3}>\s?/, ""));
						i++;
					}
					out.push("<blockquote>" + renderMarkdown(buf.join("\n")) + "</blockquote>");
					continue;
				}
				if (
					line.includes("|") &&
					i + 1 < lines.length &&
					lines[i + 1].includes("-") &&
					lines[i + 1].includes("|") &&
					/^\s*\|?[\s:|-]*$/.test(lines[i + 1])
				) {
					const parseRow = (l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
					const head = parseRow(line);
					i += 2;
					const rows = [];
					while (i < lines.length && lines[i].includes("|") && !/^\s*$/.test(lines[i])) {
						rows.push(parseRow(lines[i]));
						i++;
					}
					const thead = "<thead><tr>" + head.map((c) => "<th>" + inline(c) + "</th>").join("") + "</tr></thead>";
					const tbody =
						"<tbody>" +
						rows.map((r) => "<tr>" + head.map((_, ci) => "<td>" + inline(r[ci] ?? "") + "</td>").join("") + "</tr>").join("") +
						"</tbody>";
					out.push("<table>" + thead + tbody + "</table>");
					continue;
				}
				if (LIST_RE.test(line)) {
					const buf = [];
					while (i < lines.length) {
						const m = lines[i].match(LIST_RE);
						if (m) {
							buf.push({ indent: m[1].replace(/\t/g, "  ").length, ordered: /\d/.test(m[2][0]), text: m[3] });
							i++;
							continue;
						}
						if (/^\s*$/.test(lines[i])) {
							let j = i + 1;
							while (j < lines.length && /^\s*$/.test(lines[j])) j++;
							if (j < lines.length && LIST_RE.test(lines[j])) { i = j; continue; }
						}
						break;
					}
					out.push(buildList(buf));
					continue;
				}
				const buf = [line];
				i++;
				while (
					i < lines.length &&
					!/^\s*$/.test(lines[i]) &&
					!/^\s{0,3}(#{1,6})\s+/.test(lines[i]) &&
					!/^\s{0,3}(`{3,}|~{3,})/.test(lines[i]) &&
					!/^\s{0,3}>/.test(lines[i]) &&
					!LIST_RE.test(lines[i]) &&
					!/^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])
				) {
					buf.push(lines[i]);
					i++;
				}
				out.push("<p>" + buf.map(inline).join("<br>") + "</p>");
			}
			return out.join("\n");
		}

		/* ── 数据访问 ── */
		async function api(pathname, query) {
			const res = await fetch(pathname + "?" + query, { cache: "no-store" });
			let body = null;
			try {
				body = await res.json();
			} catch {
				body = null;
			}
			if (!body || body.ok !== true) throw new Error((body && body.error) || "HTTP " + res.status);
			return body;
		}

		/* ── 窗口位置（拖动 + 记忆） ── */
		const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
		const POS_KEY = "mdpv.pos.v1";
		function readPos() {
			try {
				const s = sessionStorage.getItem(POS_KEY);
				if (!s) return null;
				const p = JSON.parse(s);
				return p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.w) && Number.isFinite(p.h) ? p : null;
			} catch {
				return null;
			}
		}
		function persistPos(p) {
			try {
				if (p === null) sessionStorage.removeItem(POS_KEY);
				else sessionStorage.setItem(POS_KEY, JSON.stringify(p));
			} catch {
				/* ignore */
			}
		}

		/* ── 自定义背景（颜色 / 图片，持久化在 localStorage） ── */
		const BG_KEY = "mdpv.bg.v1";
		function readBg() {
			try {
				const s = localStorage.getItem(BG_KEY);
				if (!s) return null;
				const p = JSON.parse(s);
				return p && p.value && (p.type === "color" || p.type === "image") && (typeof p.textColor === "string" || p.textColor === undefined) ? p : null;
			} catch {
				return null;
			}
		}
		function persistBg(b) {
			try {
				// 视频背景只存在于当前页面会话（Blob URL 太大，不落盘）
				if (b === null || b.type === "video") localStorage.removeItem(BG_KEY);
				else localStorage.setItem(BG_KEY, JSON.stringify(b));
			} catch {
				/* 超出配额时忽略：本次会话内仍生效 */
			}
		}
		// 简易亮度判断，决定叠加文字用深色还是浅色
		function bgIsLight(hex) {
			const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
			if (!m) return true;
			const n = parseInt(m[1], 16);
			const r = (n >> 16) & 255;
			const g = (n >> 8) & 255;
			const b = n & 255;
			return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
		}
		// 估算 dataURL 的近似字节数（base64 段长 × 3/4）
		function dataUrlBytes(dataUrl) {
			const i = dataUrl.indexOf(",");
			if (i < 0) return 0;
			return Math.floor((dataUrl.length - i - 1) * 0.75);
		}

		/**
		 * 把图片 File 压缩到 ≤ maxBytes（dataURL 形式），最长边 ≤ maxEdge px。
		 * 逐级缩小画布 + 降低 JPEG 质量，返回第一个达标结果；全部不达标则抛错。
		 * 透明通道会被压进 JPEG 背景（面板本身有底色，视觉可接受）。
		 */
		async function compressImageDataUrl(file, maxBytes, maxEdge) {
			const url = URL.createObjectURL(file);
			try {
				const img = await new Promise((resolve, reject) => {
					const im = new Image();
					im.onload = () => resolve(im);
					im.onerror = () => reject(new Error("无法解码该图片（格式不支持？）"));
					im.src = url;
				});
				const nw = img.naturalWidth;
				const nh = img.naturalHeight;
				if (!nw || !nh) throw new Error("图片尺寸无效");
				const baseScale = Math.min(1, maxEdge / Math.max(nw, nh));
				for (const shrink of [1, 0.7, 0.5, 0.35, 0.25]) {
					const w = Math.max(1, Math.round(nw * baseScale * shrink));
					const h = Math.max(1, Math.round(nh * baseScale * shrink));
					const canvas = document.createElement("canvas");
					canvas.width = w;
					canvas.height = h;
					const g = canvas.getContext("2d");
					g.drawImage(img, 0, 0, w, h);
					for (const q of [0.85, 0.7, 0.55, 0.4]) {
						const dataUrl = canvas.toDataURL("image/jpeg", q);
						if (dataUrlBytes(dataUrl) <= maxBytes) return dataUrl;
					}
				}
				throw new Error("压缩后仍超出上限，请换一张更小的图片");
			} finally {
				URL.revokeObjectURL(url);
			}
		}

		function DocIcon() {
			return jsx("svg", {
				width: 16,
				height: 16,
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.4,
				"aria-hidden": true,
				children: [
					jsx("path", { d: "M4 1.5h5.5L13 5v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2.5a1 1 0 0 1 1-1Z" }),
					jsx("path", { d: "M9 1.5V5h3.5" }),
					jsx("path", { d: "M5.5 8.5h5M5.5 11h5" })
				]
			});
		}

		function LRow({ icon, label, path, onClick }) {
			return jsxs("button", {
				type: "button",
				className: "mdpv-row",
				title: path || undefined,
				onClick,
				children: [
					jsx("span", { className: "mdpv-row-icon", "aria-hidden": true, children: icon }),
					jsx("span", { className: "mdpv-row-label", children: label })
				]
			});
		}

		/* ── 预览窗口 ── */
		function MdPreviewPanel({ home, onClose }) {
			const [dir, setDir] = useState("");
			const [rows, setRows] = useState([]);
			const [parent, setParent] = useState("");
			const [file, setFile] = useState(null);
			const [raw, setRaw] = useState(false);
			const [busy, setBusy] = useState(false);
			const [error, setError] = useState(null);
			const [draft, setDraft] = useState("");
			const [editContent, setEditContent] = useState("");
			const [dirty, setDirty] = useState(false);
			const [note, setNote] = useState(null);
			const loadedRef = useRef(false);

			// 拖动状态：pos 为 null 时停靠右上角（默认 CSS），拖动后转为绝对定位
			const panelRef = useRef(null);
			const [pos, setPos] = useState(readPos);
			const dragRef = useRef(null);
			const noteTimerRef = useRef(null);

			// 自定义背景：{ type: "color" | "image" | "video", value, textColor? } | null
			const [bg, setBg] = useState(readBg);
			const [bgOpen, setBgOpen] = useState(false);
			const [bgError, setBgError] = useState(null);
			const bgWrapRef = useRef(null);
			const bgFileRef = useRef(null);
			const bgVideoRef = useRef(null);
			const bgVideoUrlRef = useRef(null); // 当前视频背景的 Blob URL
			const bgErrTimerRef = useRef(null);
			// 背景设置框拖动位置（视口坐标）；null = 默认锚定在"背景"按钮下方
			const [pickPos, setPickPos] = useState(null);
			const pickRef = useRef(null);
			const pickDragRef = useRef(null);

			// 卸载时释放视频 Blob URL
			useEffect(
				() => () => {
					if (bgVideoUrlRef.current) URL.revokeObjectURL(bgVideoUrlRef.current);
				},
				[]
			);

			const loadDir = useCallback(async (p) => {
				if (!p) return;
				setBusy(true);
				setError(null);
				setFile(null);
				try {
					const body = await api("/md-preview/list", "dir=" + encodeURIComponent(p));
					setDir(body.dir);
					setRows(body.rows);
					setParent(body.parent || "");
				} catch (e) {
					setError(String((e && e.message) || e));
				} finally {
					setBusy(false);
				}
			}, []);

			const openFile = useCallback(async (p) => {
				setBusy(true);
				setError(null);
				try {
					const body = await api("/md-preview/read", "path=" + encodeURIComponent(p));
					setFile({ path: body.path, content: body.content, size: body.size, mtimeMs: body.mtimeMs });
				} catch (e) {
					setError(String((e && e.message) || e));
				} finally {
					setBusy(false);
				}
			}, []);

			const flashNote = useCallback((text) => {
				setNote(text);
				if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
				noteTimerRef.current = setTimeout(() => setNote(null), 2500);
			}, []);
			useEffect(
				() => () => {
					if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
				},
				[]
			);

			// 打开/替换文件时，重置编辑草稿
			useEffect(() => {
				setEditContent(file ? file.content : "");
				setDirty(false);
			}, [file && file.path]);

			// 保存（Ctrl/Cmd+S 或按钮）
			const saveFile = useCallback(async () => {
				if (!file || !dirty || busy) return;
				setBusy(true);
				setError(null);
				try {
					const res = await fetch("/md-preview/write", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ path: file.path, content: editContent, mtimeMs: file.mtimeMs })
					});
					const body = await res.json().catch(() => null);
					if (!body || body.ok !== true) {
						const e = new Error((body && body.error) || "HTTP " + res.status);
						e.conflict = Boolean(body && body.conflict);
						throw e;
					}
					setFile({ path: body.path, content: body.content !== undefined ? body.content : editContent, size: body.size, mtimeMs: body.mtimeMs });
					setDirty(false);
					flashNote("已保存 ✓");
				} catch (e) {
					const msg = String((e && e.message) || e);
					setError(e && e.conflict ? "⚠ " + msg + "（点「刷新」重新加载后再保存）" : msg);
				} finally {
					setBusy(false);
				}
			}, [file, dirty, busy, editContent, flashNote]);

			useEffect(() => {
				if (home && !loadedRef.current) {
					loadedRef.current = true;
					loadDir(home);
				}
			}, [home, loadDir]);

			useEffect(() => {
				const onKey = (e) => {
					if (e.key === "Escape") requestCloseRef.current();
				};
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			}, []);

			useEffect(() => {
				const onKey = (e) => {
					if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
						e.preventDefault();
						if (file && dirty && !busy) saveFile();
					}
				};
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			}, [file, dirty, busy, saveFile]);

			// 背景选择器：点击外部收起
			useEffect(() => {
				if (!bgOpen) return;
				const onDown = (e) => {
					if (bgWrapRef.current && !bgWrapRef.current.contains(e.target)) setBgOpen(false);
				};
				document.addEventListener("pointerdown", onDown);
				return () => document.removeEventListener("pointerdown", onDown);
			}, [bgOpen]);

			// 背景选择器：收起时复位到默认锚点
			useEffect(() => {
				if (!bgOpen) setPickPos(null);
			}, [bgOpen]);

			// 背景选择器：可拖动（首次移动时从锚定定位切换为视口 fixed 定位）
			const onPickPointerDown = (e) => {
				if (e.button !== 0) return;
				if (e.target.closest("button, input, a")) return;
				const el = pickRef.current;
				if (!el) return;
				e.stopPropagation(); // 避免触发外层标题栏的窗口拖动
				const r = el.getBoundingClientRect();
				pickDragRef.current = { px: e.clientX, py: e.clientY, x: r.left, y: r.top };
				try {
					e.currentTarget.setPointerCapture(e.pointerId);
				} catch {
					/* ignore */
				}
			};
			const onPickPointerMove = (e) => {
				const d = pickDragRef.current;
				const el = pickRef.current;
				if (!d || !el) return;
				if (!pickPos) {
					el.style.position = "fixed";
					el.style.right = "auto";
					el.style.left = d.x + "px";
					el.style.top = d.y + "px";
				}
				const nx = clamp(d.x + (e.clientX - d.px), 4, Math.max(4, window.innerWidth - el.offsetWidth - 4));
				const ny = clamp(d.y + (e.clientY - d.py), 4, Math.max(4, window.innerHeight - el.offsetHeight - 4));
				el.style.left = nx + "px";
				el.style.top = ny + "px";
			};
			const onPickPointerUp = () => {
				const d = pickDragRef.current;
				if (!d) return;
				pickDragRef.current = null;
				const el = pickRef.current;
				if (el && el.style.position === "fixed") {
					setPickPos({ x: parseFloat(el.style.left) || 0, y: parseFloat(el.style.top) || 0 });
				}
			};

			const applyBg = (b) => {
				// 视频背景：替换或移除时释放旧的 Blob URL
				if (bgVideoUrlRef.current && (!b || b.type !== "video" || b.value !== bgVideoUrlRef.current)) {
					URL.revokeObjectURL(bgVideoUrlRef.current);
					bgVideoUrlRef.current = null;
				}
				if (b && b.type === "video" && b.value) bgVideoUrlRef.current = b.value;
				setBg(b);
				persistBg(b);
			};
			const onBgColor = (e) => {
				applyBg({ type: "color", value: e.target.value });
			};
			const showBgMsg = (text) => {
				setBgError(text);
				if (bgErrTimerRef.current) clearTimeout(bgErrTimerRef.current);
				bgErrTimerRef.current = setTimeout(() => setBgError(null), 4000);
			};
			const onBgImageFile = async (e) => {
				const f = e.target.files && e.target.files[0];
				e.target.value = "";
				if (!f) return;
				setBgError(null);
				if (f.size > 1536 * 1024) {
					showBgMsg("图片较大，正在压缩…");
					try {
						const dataUrl = await compressImageDataUrl(f, 1536 * 1024, 1920);
						applyBg({ type: "image", value: dataUrl });
						setBgError(null);
					} catch (err) {
						showBgMsg("压缩失败：" + String((err && err.message) || err));
					}
					return;
				}
				const reader = new FileReader();
				reader.onload = () => applyBg({ type: "image", value: String(reader.result) });
				reader.onerror = () => showBgMsg("读取图片失败");
				reader.readAsDataURL(f);
			};
			// 视频背景：用 Blob URL 播放，仅当前页面会话有效（不落盘）
			const onBgVideoFile = (e) => {
				const f = e.target.files && e.target.files[0];
				e.target.value = "";
				if (!f) return;
				setBgError(null);
				if (f.size > 50 * 1024 * 1024) {
					showBgMsg("视频太大（≤50MB）");
					return;
				}
				applyBg({ type: "video", value: URL.createObjectURL(f) });
			};
			// 自定义文字颜色（不设则按背景自动取深浅）
			const onBgTextColor = (e) => {
				if (!bg) return;
				applyBg({ ...bg, textColor: e.target.value });
			};
			const clearBgTextColor = () => {
				if (!bg) return;
				const next = { ...bg };
				delete next.textColor;
				applyBg(next);
			};
			const resetBg = () => applyBg(null);

			// 未保存修改的退出守卫：干净时直接放行并执行 action；脏时先确认
			const guardDiscard = useCallback(
				(action) => {
					if (dirty && !window.confirm("有未保存的修改，确定放弃吗？")) return false;
					if (action) action();
					return true;
				},
				[dirty]
			);
			const requestClose = () => {
				if (guardDiscard(() => { setDirty(false); })) onClose();
			};
			const requestCloseRef = useRef(requestClose);
			requestCloseRef.current = requestClose;

			// 标题栏拖动（指针事件 + setPointerCapture；按钮/输入框上不启动拖动）
			const onHeaderPointerDown = (e) => {
				if (e.button !== 0) return;
				if (e.target.closest("button, input, a, .mdpv-bgpick")) return;
				const panel = panelRef.current;
				if (!panel) return;
				const rect = panel.getBoundingClientRect();
				dragRef.current = {
					px: e.clientX,
					py: e.clientY,
					x: pos ? pos.x : rect.left,
					y: pos ? pos.y : rect.top,
					w: pos ? pos.w : rect.width,
					h: pos ? pos.h : rect.height
				};
				try {
					e.currentTarget.setPointerCapture(e.pointerId);
				} catch {
					/* ignore */
				}
			};
			const onHeaderPointerMove = (e) => {
				const start = dragRef.current;
				if (!start) return;
				const vw = window.innerWidth;
				const vh = window.innerHeight;
				const x = clamp(start.x + (e.clientX - start.px), 0, Math.max(0, vw - start.w));
				const y = clamp(start.y + (e.clientY - start.py), 0, Math.max(0, vh - start.h));
				setPos((prev) => {
					const next = { x, y, w: start.w, h: start.h };
					return prev && prev.x === x && prev.y === y ? prev : next;
				});
			};
			const onHeaderPointerUp = (e) => {
				if (!dragRef.current) return;
				dragRef.current = null;
				try {
					e.currentTarget.releasePointerCapture(e.pointerId);
				} catch {
					/* ignore */
				}
				persistPos(pos);
			};
			const onHeaderDoubleClick = (e) => {
				if (e.target.closest(".mdpv-bgpick")) return;
				setPos(null);
				persistPos(null);
			};

			const jump = () => {
				const p = draft.trim();
				if (!p) return;
				if (!guardDiscard(null)) return;
				setDraft("");
				if (/\.(md|markdown|mdown)$/i.test(p)) openFile(p);
				else loadDir(p);
			};
			const refresh = () => {
				if (!guardDiscard(null)) return;
				if (file) openFile(file.path);
				else if (dir) loadDir(dir);
			};

			const listBody = [
				!dir
					? jsx("div", { className: "mdpv-status", children: "在上方输入一个目录路径开始浏览（已尝试自动填入当前会话的工作区）。" })
					: null,
				dir ? jsx("div", { className: "mdpv-crumbs", children: dir }) : null,
				parent ? jsx(LRow, { key: "up", icon: "↩", label: "..", path: parent, onClick: () => guardDiscard(() => loadDir(parent)) }) : null,
				...rows.map((r) =>
					jsx(LRow, {
						key: r.path,
						icon: r.dir ? "📁" : "📄",
						label: r.name,
						path: r.path,
						onClick: () => guardDiscard(() => (r.dir ? loadDir(r.path) : openFile(r.path)))
					})
				)
			];

			const panelStyle = {};
			if (pos) {
				panelStyle.left = pos.x + "px";
				panelStyle.top = pos.y + "px";
				panelStyle.width = pos.w + "px";
				panelStyle.height = pos.h + "px";
				panelStyle.right = "auto";
				panelStyle.bottom = "auto";
			}
			if (bg) {
				let autoText;
				if (bg.type === "color") {
					panelStyle.backgroundColor = bg.value;
					autoText = bgIsLight(bg.value) ? "#1f2328" : "#f5f7fa";
				} else if (bg.type === "image") {
					// 图片上叠加一层半透明暗层（线性渐变层盖在图片层之上），保证文字可读
					panelStyle.backgroundImage =
						"linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(\"" + bg.value + "\")";
					panelStyle.backgroundSize = "cover";
					panelStyle.backgroundPosition = "center";
					panelStyle.backgroundRepeat = "no-repeat";
					autoText = "#f5f7fa";
				} else if (bg.type === "video") {
					// 视频由 <video> 元素铺底，这里只定文字色
					autoText = "#f5f7fa";
				}
				// 自定义文字颜色优先，否则按背景自动取深浅；同时写 --mdpv-text 供正文/列表/编辑区使用
				const finalText = (typeof bg.textColor === "string" && bg.textColor) || autoText;
				if (finalText) {
					panelStyle.color = finalText;
					panelStyle["--mdpv-text"] = finalText;
				}
			}

			const inEdit = Boolean(file && raw);

			return jsxs("div", {
				ref: panelRef,
				className:
					"mdpv-panel" +
					(pos ? " mdpv-panel-free" : "") +
					(bg && bg.type === "video" ? " mdpv-panel-video" : ""),
				style: panelStyle,
				role: "dialog",
				"aria-label": "MD 预览",
				children: [
					bg && bg.type === "video"
						? jsx("video", {
								className: "mdpv-video",
								src: bg.value,
								autoPlay: true,
								loop: true,
								muted: true,
								playsInline: true,
								"aria-hidden": true
						  })
						: null,
					bg && bg.type === "video" ? jsx("div", { className: "mdpv-video-scrim" }) : null,
					jsxs(
						"div",
						{
							className: "mdpv-head",
							title: "拖动移动窗口 · 双击复位",
							onPointerDown: onHeaderPointerDown,
							onPointerMove: onHeaderPointerMove,
							onPointerUp: onHeaderPointerUp,
							onDoubleClick: onHeaderDoubleClick,
							children: [
								jsx("span", { className: "mdpv-title", children: "MD 预览" }),
								file
									? jsx("span", { className: "mdpv-file", title: file.path + (dirty ? "（未保存）" : ""), children: file.path })
									: null,
								note ? jsx("span", { className: "mdpv-note", children: note }) : null,
								jsxs("span", {
									className: "mdpv-head-actions",
									children: [
										file
											? jsx("button", {
													type: "button",
													className: "mdpv-seg" + (!raw ? " mdpv-seg-active" : ""),
													onClick: () => setRaw(false),
													children: "渲染"
												})
											: null,
										file
											? jsx("button", {
													type: "button",
													className: "mdpv-seg" + (raw ? " mdpv-seg-active" : ""),
													onClick: () => setRaw(true),
													children: "源码"
												})
											: null,
										file
											? jsx("button", {
													type: "button",
													className: "mdpv-seg" + (dirty ? " mdpv-seg-active" : ""),
													onClick: saveFile,
													disabled: busy || !dirty,
													title: "保存（Ctrl/Cmd+S）",
													children: dirty ? "保存 ●" : "已保存"
												})
											: null,
										jsxs("span", {
											className: "mdpv-bgwrap",
											ref: bgWrapRef,
											children: [
												jsx("button", {
													type: "button",
													className: "mdpv-seg" + (bgOpen ? " mdpv-seg-active" : ""),
													onClick: () => setBgOpen((v) => !v),
													title: "背景颜色 / 背景图片",
													children: bg ? "背景 ●" : "背景"
												}),
												bgOpen
													? jsxs("div", {
															ref: pickRef,
															className: "mdpv-bgpick",
															title: "可拖动",
															style: pickPos
																? { position: "fixed", left: pickPos.x + "px", top: pickPos.y + "px", right: "auto" }
																: undefined,
															onPointerDown: onPickPointerDown,
															onPointerMove: onPickPointerMove,
															onPointerUp: onPickPointerUp,
															onPointerCancel: onPickPointerUp,
															children: [
																jsxs("div", {
																	className: "mdpv-bgpick-row",
																	children: [
																		jsx("input", {
																			className: "mdpv-color",
																			type: "color",
																			value: bg && bg.type === "color" ? bg.value : "#1e1e2e",
																			onChange: onBgColor,
																			"aria-label": "选择背景颜色"
																		}),
																		jsx("span", {
																			className: "mdpv-bgpick-label",
																			children: "纯色背景"
																		})
																	]
																}),
																jsxs("div", {
																	className: "mdpv-bgpick-row",
																	children: [
																		jsx("button", {
																			type: "button",
																			className: "mdpv-seg",
																			onClick: () => bgFileRef.current && bgFileRef.current.click(),
																			children: "选择图片…"
																		}),
																		bg && bg.type === "image"
																			? jsx("button", {
																					type: "button",
																					className: "mdpv-seg",
																					onClick: resetBg,
																					children: "移除图片"
																				})
																			: null
																	]
																}),
																jsxs("div", {
																	className: "mdpv-bgpick-row",
																	children: [
																		jsx("button", {
																			type: "button",
																			className: "mdpv-seg",
																			onClick: () => bgVideoRef.current && bgVideoRef.current.click(),
																			children: "选择视频…"
																		}),
																		bg && bg.type === "video"
																			? jsx("button", {
																					type: "button",
																					className: "mdpv-seg",
																					onClick: resetBg,
																					children: "移除视频"
																				})
																			: null,
																		bg && bg.type === "video"
																			? jsx("span", {
																					className: "mdpv-bgpick-msg",
																					children: "仅本次会话有效"
																				})
																			: null
																	]
																}),
																jsxs("div", {
																	className: "mdpv-bgpick-row",
																	children: [
																		jsx("input", {
																			className: "mdpv-color",
																			type: "color",
																			value:
																				(bg && bg.textColor) ||
																				(bg && bg.type === "color" ? (bgIsLight(bg.value) ? "#1f2328" : "#f5f7fa") : "#f5f7fa"),
																			onChange: onBgTextColor,
																			disabled: !bg,
																			"aria-label": "选择文字颜色"
																		}),
																		jsx("span", {
																			className: "mdpv-bgpick-label",
																			children: bg ? "文字颜色（默认自动）" : "文字颜色（先选背景）"
																		}),
																		bg && bg.textColor
																			? jsx("button", {
																					type: "button",
																					className: "mdpv-seg",
																					onClick: clearBgTextColor,
																					children: "自动"
																				})
																			: null
																	]
																}),
																jsx("button", {
																	type: "button",
																	className: "mdpv-seg",
																	onClick: resetBg,
																	children: "恢复主题默认"
																}),
																bgError
																	? jsx("div", { className: "mdpv-bgpick-err", children: bgError })
																	: null,
																jsx("input", {
																	ref: bgFileRef,
																	type: "file",
																	accept: "image/*",
																	style: { display: "none" },
																	onChange: onBgImageFile,
																	tabIndex: -1,
																	"aria-hidden": true
																}),
																jsx("input", {
																	ref: bgVideoRef,
																	type: "file",
																	accept: "video/*",
																	style: { display: "none" },
																	onChange: onBgVideoFile,
																	tabIndex: -1,
																	"aria-hidden": true
																})
															]
														})
													: null
											]
										}),
										jsx("button", {
											type: "button",
											className: "mdpv-seg",
											onClick: refresh,
											disabled: busy || (!file && !dir),
											children: "刷新"
										}),
										jsx("button", {
											type: "button",
											className: "mdpv-seg",
											onClick: requestClose,
											"aria-label": "关闭",
											children: "✕"
										})
									]
								})
							]
						}
					),
					jsxs("div", {
						className: "mdpv-pathbar",
						children: [
							jsx("input", {
								className: "mdpv-input",
								value: draft,
								placeholder: "输入绝对路径（目录或 .md 文件）后回车跳转…",
								onChange: (e) => setDraft(e.target.value),
								onKeyDown: (e) => {
									if (e.key === "Enter") jump();
								}
							}),
							jsx("button", {
								type: "button",
								className: "mdpv-seg",
								onClick: jump,
								disabled: !draft.trim(),
								children: "跳转"
							})
						]
					}),
					jsxs("div", {
						className: "mdpv-body" + (inEdit ? " mdpv-body-edit" : ""),
						children: [
							busy ? jsx("div", { className: "mdpv-status", children: "加载中…" }) : null,
							error ? jsx("div", { className: "mdpv-status mdpv-error", children: error }) : null,
							file
								? raw
									? jsx("textarea", {
											className: "mdpv-edit",
											value: editContent,
											spellCheck: false,
											"aria-label": "Markdown 源码（可编辑）",
											placeholder: "（空文件）",
											onChange: (e) => {
												setEditContent(e.target.value);
												setDirty(true);
											}
										})
									: jsx("div", {
											className: "mdpv-md",
											dangerouslySetInnerHTML: { __html: renderMarkdown(file.content) }
										})
								: jsx("div", { children: listBody })
						]
					})
				]
			});
		}

		/* ── 侧栏底部按钮 ── */
		function MdPreviewControl(props) {
			const useSessions = typeof props.useSessions === "function" ? props.useSessions : () => undefined;
			const useWorkspaces = typeof props.useWorkspaces === "function" ? props.useWorkspaces : () => undefined;
			const cwd = useSessions((s) => {
				const c = s && s.current;
				return c && s.byId ? (s.byId[c] && s.byId[c].cwd) || undefined : undefined;
			});
			const recentPath = useWorkspaces((w) => {
				const id = w && w.recentWorkspaceId;
				if (!id || !w.items) return undefined;
				const item = w.items.find((i) => i.workspaceId === id);
				return item ? item.path : undefined;
			});
			const home = cwd || recentPath;
			const [open, setOpen] = useState(false);
			return jsxs(Fragment, {
				children: [
					jsx("button", {
						type: "button",
						className: "mdpv-btn" + (open ? " mdpv-btn-active" : ""),
						"aria-label": "MD 预览",
						"aria-pressed": open,
						title: "MD 预览",
						onClick: () => setOpen((v) => !v),
						children: jsx(DocIcon, {})
					}),
					open ? reactDom.createPortal(jsx(MdPreviewPanel, { home, onClose: () => setOpen(false) }), document.body) : null
				]
			});
		}

		/* ── 插件体 ── */
		const inject = ["slots"];
		function apply(ctx) {
			ctx.slots.inject("sidebar.footer.action", () =>
				ctx.slots.register(
					{
						name: "sidebar.footer.action",
						id: "md-preview",
						order: 20,
						label: "MD 预览"
					},
					MdPreviewControl
				)
			);
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});