/**
 * dsh-plugin-md-preview — 宿主半边（node half）。
 *
 * 在 webserver 上注册 `/md-preview` 前缀路由，供浏览器半边拉取/保存 Markdown：
 *   GET  /md-preview/read?path=<绝对路径>   -> { ok, path, size, mtimeMs, content }
 *   GET  /md-preview/list?dir=<绝对路径>    -> { ok, dir, parent, rows }
 *   POST /md-preview/write（JSON { path, content, mtimeMs? }）
 *                                    -> { ok, path, size, mtimeMs }
 *
 * 安全边界（本机 127.0.0.1 信任模型下仍保持最小）：
 *   - read：仅 GET/HEAD，只允许 .md / .markdown / .mdown 扩展名，文件不超过 2MB；
 *   - list：只返回目录与 .md 文件条目；
 *   - write：仅 .md 文件，新内容不超过 2MB，请求体不超过 3MB；
 *     带 mtime 冲突检测（409），防止覆盖未同步的外部修改；
 *     临时文件 + rename 原子替换，中断不会留下半截文件；
 *   - 路径原样透传（GUI 仅绑定回环地址，等价于本机 shell 的可读写范围）。
 */
import { readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join, sep } from "node:path";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_BODY_BYTES = 3 * 1024 * 1024;
const isMd = (name) => /\.(md|markdown|mdown)$/i.test(name);

function json(res, code, body) {
	res.writeHead(code, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-cache"
	});
	res.end(JSON.stringify(body));
}

/** 读取请求体（带 3MB 上限）。超限抛出带 status 的错误。 */
async function readBody(req) {
	let size = 0;
	const chunks = [];
	for await (const chunk of req) {
		size += chunk.length;
		if (size > MAX_BODY_BYTES) {
			throw Object.assign(new Error("request body exceeds the 3MB cap"), { status: 413 });
		}
		chunks.push(chunk);
	}
	return Buffer.concat(chunks);
}

/** 校验并准备写入目标，返回 tmp 路径；失败抛出 { status, message }。 */
async function prepareWrite(p, content, mtimeMs) {
	if (!isMd(p)) throw Object.assign(new Error("only .md / .markdown files can be written"), { status: 400 });
	if (Buffer.byteLength(content, "utf8") > MAX_BYTES) {
		throw Object.assign(new Error("content exceeds the 2MB write cap"), { status: 413 });
	}
	let st;
	try {
		st = await stat(p);
	} catch {
		throw Object.assign(new Error("file not found"), { status: 404 });
	}
	if (!st.isFile()) throw Object.assign(new Error("not a regular file"), { status: 400 });
	if (mtimeMs !== null && Math.abs(st.mtimeMs - mtimeMs) > 1) {
		throw Object.assign(new Error("the file was modified externally; reload and retry"), { status: 409, conflict: true });
	}
	return join(dirname(p), "." + basename(p) + ".mdpv-tmp-" + process.pid);
}

async function handle(req, res) {
	const url = new URL(req.url ?? "/", "http://x");
	const param = (key) => {
		const raw = url.searchParams.get(key);
		try {
			return raw === null ? "" : decodeURIComponent(raw);
		} catch {
			return "";
		}
	};
	try {
		if (req.method === "POST" && url.pathname === "/md-preview/write") {
			let payload;
			try {
				payload = JSON.parse((await readBody(req)).toString("utf8"));
			} catch (error) {
				if (error && error.status === 413) {
					return json(res, 413, { ok: false, error: "request body exceeds the 3MB cap" });
				}
				return json(res, 400, { ok: false, error: "invalid JSON body" });
			}
			const p = payload && typeof payload.path === "string" ? payload.path : "";
			const content = payload && typeof payload.content === "string" ? payload.content : null;
			const mtimeMs =
				payload && typeof payload.mtimeMs === "number" && Number.isFinite(payload.mtimeMs) ? payload.mtimeMs : null;
			if (!p) return json(res, 400, { ok: false, error: "missing path" });
			if (content === null) return json(res, 400, { ok: false, error: "missing content" });
			let tmp;
			try {
				tmp = await prepareWrite(p, content, mtimeMs);
			} catch (error) {
				const status = error && error.status ? error.status : 500;
				return json(res, status, {
					ok: false,
					conflict: Boolean(error && error.conflict),
					error: error instanceof Error ? error.message : String(error)
				});
			}
			try {
				await writeFile(tmp, content, "utf8");
				await rename(tmp, p);
			} catch (error) {
				await unlink(tmp).catch(() => {});
				throw error;
			}
			const st2 = await stat(p);
			return json(res, 200, { ok: true, path: p, size: Buffer.byteLength(content, "utf8"), mtimeMs: st2.mtimeMs });
		}
		if (req.method !== "GET" && req.method !== "HEAD") {
			return json(res, 405, { ok: false, error: "method not allowed" });
		}
		if (url.pathname === "/md-preview/read") {
			const p = param("path");
			if (!p) return json(res, 400, { ok: false, error: "missing ?path=" });
			if (!isMd(p)) return json(res, 400, { ok: false, error: "only .md / .markdown files can be read" });
			const st = await stat(p);
			if (!st.isFile()) return json(res, 400, { ok: false, error: "not a regular file" });
			if (st.size > MAX_BYTES) return json(res, 413, { ok: false, error: "file exceeds the 2MB preview cap" });
			const content = await readFile(p, "utf8");
			return json(res, 200, { ok: true, path: p, size: st.size, mtimeMs: st.mtimeMs, content });
		}
		if (url.pathname === "/md-preview/list") {
			const p = param("dir");
			if (!p) return json(res, 400, { ok: false, error: "missing ?dir=" });
			const st = await stat(p);
			if (!st.isDirectory()) return json(res, 400, { ok: false, error: "not a directory" });
			const entries = await readdir(p, { withFileTypes: true });
			const base = p.replace(/[\\/]+$/, "");
			const rows = [];
			for (const e of entries) {
				const dir = e.isDirectory();
				if (!dir && !isMd(e.name)) continue;
				rows.push({ name: e.name, dir, path: base + sep + e.name });
			}
			rows.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
			return json(res, 200, { ok: true, dir: p, parent: dirname(p), rows });
		}
		return json(res, 404, { ok: false, error: "unknown endpoint" });
	} catch (error) {
		return json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
	}
}

/**
 * 宿主插件体：挂载 `/md-preview` 前缀路由，fiber 卸载时自动摘除。
 * @param ctx - 宿主 context（注入 webServer 服务）。
 */
function apply(ctx) {
	const dispose = ctx.webServer.register({
		kind: "prefix",
		path: "/md-preview",
		handler: handle
	});
	ctx.effect(() => dispose, "md-preview: host routes");
}
const inject = ["webServer"];

export { apply, inject };