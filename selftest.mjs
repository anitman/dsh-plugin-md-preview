// 自测：抽取 client.js 中的零依赖 Markdown 渲染器并在 Node 中验证。
// 运行：node selftest.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("./client.js", import.meta.url), "utf8");
const start = src.indexOf("/* ── 零依赖紧凑 Markdown 渲染器 ── */");
const end = src.indexOf("/* ── 数据访问 ── */");
if (start === -1 || end === -1 || end <= start) throw new Error("renderer section not found");
const code = src.slice(start, end) + "\nglobalThis.renderMarkdown = renderMarkdown;";
const sandbox = { globalThis };
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: "renderer.js" });
const renderMarkdown = sandbox.renderMarkdown;

const md = [
	"# 大标题",
	"",
	"一段 **加粗**、*斜体*、`行内代码` 与 [链接](https://example.com) 以及裸链 https://foo.bar/baz 。",
	"",
	"> 引用行 第一行",
	"> 引用行 第二行",
	"",
	"- 无序一",
	"- 无序二",
	"  - 嵌套项",
	"1. 有序一",
	"2. 有序二",
	"",
	"| 列A | 列B |",
	"| --- | --- |",
	"| a1 | b1 |",
	"",
	"```js",
	"const x = 1; // <not html>",
	"```",
	"",
	"---",
	"",
	"末段第一行",
	"末段第二行"
].join("\n");

const html = renderMarkdown(md);
const checks = {
	h1: /<h1>大标题<\/h1>/.test(html),
	bold: /<strong>加粗<\/strong>/.test(html),
	em: /<em>斜体<\/em>/.test(html),
	inlineCode: /<code>行内代码<\/code>/.test(html),
	link: /<a href="https:\/\/example\.com" target="_blank" rel="noreferrer">链接<\/a>/.test(html),
	autolink: /<a href="https:\/\/foo\.bar\/baz"/.test(html),
	blockquote: /<blockquote>/.test(html) && html.includes("引用行 第二行"),
	ul: /<ul><li>无序一<\/li><li>无序二/.test(html),
	nested: /<ul><li>嵌套项<\/li><\/ul>/.test(html),
	ol: /<ol><li>有序一<\/li><li>有序二<\/li><\/ol>/.test(html),
	table: /<table>/.test(html) && /<th>列A<\/th>/.test(html) && /<td>a1<\/td>/.test(html),
	pre: /<pre><code class="lang-js">/.test(html),
	codeEscaped: html.includes("&lt;not html&gt;") && !html.includes("<not html>"),
	hr: /<hr>/.test(html),
	paraBreaks: /<p>末段第一行<br>末段第二行<\/p>/.test(html),
	noRawTags: !/<h1>大标题<script>/.test(html)
};
let failed = 0;
for (const [name, ok] of Object.entries(checks)) {
	if (!ok) failed++;
	console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}
// XSS 基本防护（开标签）
const xss = renderMarkdown("恶意 <script>alert(1)</script> 内容");
if (!xss.includes("<script>") && xss.includes("&lt;script&gt;")) console.log("PASS  xss-escaped");
else { failed++; console.log("FAIL  xss-escaped"); }
// XSS 闭合标签（不能提前闭合宿主的 <style>/<script> 上下文）
const xss2 = renderMarkdown("</script><script>evil</script>");
if (!xss2.includes("</script>") && xss2.includes("&lt;/script&gt;")) console.log("PASS  xss-closing-tag-escaped");
else { failed++; console.log("FAIL  xss-closing-tag-escaped"); }
console.log(failed === 0 ? "\nALL OK" : `\n${failed} CHECKS FAILED`);
process.exit(failed === 0 ? 0 : 1);