// 宿主 write 端点集成测试：起临时 http server 挂 handle，打真实 HTTP 请求。
import http from "node:http";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { apply } from "./index.js";

const dir = mkdtempSync(join(tmpdir(), "mdpv-"));
const md = join(dir, "a.md");
const txt = join(dir, "b.txt");
writeFileSync(md, "v1\n");
writeFileSync(txt, "nope");

const routes = [];
apply({
	webServer: { register: (r) => { routes.push(r); return () => {}; } },
	effect: () => {}
});
const server = http.createServer((req, res) => routes[0].handler(req, res));
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = "http://127.0.0.1:" + server.address().port;

async function get(path) {
	const res = await fetch(base + path);
	return { status: res.status, body: await res.json() };
}
async function post(path, obj) {
	const res = await fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });
	return { status: res.status, body: await res.json() };
}

let pass = 0, fail = 0;
function check(name, cond) {
	console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
	cond ? pass++ : fail++;
}

// 1. read 带 mtimeMs
const r1 = await get("/md-preview/read?path=" + encodeURIComponent(md));
check("read ok + mtimeMs", r1.status === 200 && r1.body.ok && typeof r1.body.mtimeMs === "number" && r1.body.content === "v1\n");

// 2. write 成功（mtime 匹配）
const w1 = await post("/md-preview/write", { path: md, content: "v2 edited\n", mtimeMs: r1.body.mtimeMs });
check("write ok", w1.status === 200 && w1.body.ok && w1.body.size === Buffer.byteLength("v2 edited\n"));
check("write landed on disk", readFileSync(md, "utf8") === "v2 edited\n");

// 3. 旧 mtime -> 409 conflict
const w2 = await post("/md-preview/write", { path: md, content: "v3\n", mtimeMs: r1.body.mtimeMs });
check("stale mtime -> 409 conflict", w2.status === 409 && w2.body.conflict === true);
check("conflict did not modify file", readFileSync(md, "utf8") === "v2 edited\n");

// 4. 非 md 文件 -> 400
const w3 = await post("/md-preview/write", { path: txt, content: "hack\n" });
check("non-md rejected 400", w3.status === 400);
check("txt untouched", readFileSync(txt, "utf8") === "nope");

// 5. 超大内容 -> 413
const big = "x".repeat(2 * 1024 * 1024 + 1);
const w4 = await post("/md-preview/write", { path: md, content: big });
check("oversize rejected 413", w4.status === 413);

// 6. 文件不存在 -> 404
const w5 = await post("/md-preview/write", { path: join(dir, "ghost.md"), content: "x" });
check("missing file -> 404", w5.status === 404);

// 7. 不存在的 tmp 残留检查
check("no tmp leftovers", existsSync(join(dir, ".a.md.mdpv-tmp-" + process.pid)) === false);

// 8. 不带 mtimeMs 也能写（前向兼容）
const w6 = await post("/md-preview/write", { path: md, content: "v4 no-mtime\n" });
check("write without mtimeMs ok", w6.status === 200 && readFileSync(md, "utf8") === "v4 no-mtime\n");

// 9. 坏 JSON -> 400
const bad = await fetch(base + "/md-preview/write", { method: "POST", body: "not-json" });
check("bad json -> 400", bad.status === 400);

server.close();
rmSync(dir, { recursive: true, force: true });
console.log(fail === 0 ? "\nALL OK" : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);