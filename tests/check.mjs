// 코드 검사 (단순 수정 때 이것만 돌림)
// 1) 자바스크립트 문법(따옴표·괄호 짝 포함)  2) HTML 태그 짝 · CSS 중괄호 짝
// 3) 단추·화면 요소가 가리키는 id와 함수가 실제로 있는지  4) 판 번호가 파일마다 같은지
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const html = read("index.html");
const problems = [], notes = [];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "chk-"));

// 1) 문법 검사: index.html 안의 스크립트들과 따로 있는 .js 파일
function syntax(code, name, mod){
  const f = path.join(tmp, name.replace(/[^\w.-]/g, "_") + (mod ? ".mjs" : ".cjs"));
  fs.writeFileSync(f, code);
  try{ execFileSync(process.execPath, ["--check", f], {stdio: "pipe"}); }
  catch(e){ problems.push(`문법 오류 (${name}): ` + String(e.stderr || e.message).split("\n").filter(Boolean).slice(0, 4).join(" / ")); }
}
const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
scripts.forEach((m, i) => {
  if (/\bsrc=/.test(m[1]) || !m[2].trim()) return;
  syntax(m[2], `index.html 스크립트 ${i + 1}`, /type="module"/.test(m[1]));
});
for (const f of fs.readdirSync(ROOT)){
  if (!f.endsWith(".js")) continue;
  const code = read(f);
  syntax(code, f, /^\s*(import|export)\s/m.test(code));
}

// 2) HTML 태그 짝(스크립트·스타일 밖) · CSS 중괄호 짝
const bare = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<!--[\s\S]*?-->/g, "");
for (const tag of ["div", "section", "form", "button", "ul", "ol", "li", "label", "select", "details", "aside", "header", "main", "footer", "nav", "span", "p", "a", "h1", "h2", "h3", "table", "tr", "td", "textarea"]){
  const open = (bare.match(new RegExp(`<${tag}(\\s|>)`, "g")) || []).length;
  const close = (bare.match(new RegExp(`</${tag}>`, "g")) || []).length;
  if (open !== close) problems.push(`HTML <${tag}> 짝이 안 맞음: 여는 태그 ${open}, 닫는 태그 ${close}`);
}
[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].forEach((m, i) => {
  const css = m[1].replace(/\/\*[\s\S]*?\*\//g, "").replace(/"[^"\n]*"|'[^'\n]*'/g, "");
  const o = (css.match(/{/g) || []).length, c = (css.match(/}/g) || []).length;
  if (o !== c) problems.push(`CSS ${i + 1}번째 <style> 중괄호 짝이 안 맞음: { ${o}개, } ${c}개`);
});

// 3) id · 함수 연결
const js = scripts.filter(m => !/\bsrc=/.test(m[1])).map(m => m[2]).join("\n");
const defined = new Set([...html.matchAll(/\bid=["'`]([\w-]+)["'`]/g)].map(m => m[1]).concat([...js.matchAll(/\.id\s*=\s*["'`]([\w-]+)["'`]/g)].map(m => m[1])));
const used = new Set([...js.matchAll(/getElementById\(\s*["'`]([\w-]+)["'`]\s*\)/g)].map(m => m[1]).concat([...js.matchAll(/querySelector(?:All)?\(\s*["'`]#([\w-]+)["'`]\s*\)/g)].map(m => m[1])));
const missingIds = [...used].filter(id => !defined.has(id));
if (missingIds.length) problems.push("화면에 없는 id를 찾는 코드: " + missingIds.join(", "));
// 단추에 직접 붙인 onclick="함수()" — 함수가 있는지
const fnDefined = name => new RegExp(`(function\\s+${name}\\s*\\(|(const|let|var)\\s+${name}\\s*=|window\\.${name}\\s*=)`).test(js);
[...bare.matchAll(/\son\w+="\s*([A-Za-z_$][\w$]*)\s*\(/g)].forEach(m => { if (!fnDefined(m[1])) problems.push(`단추가 부르는 함수 ${m[1]}() 가 없음`); });
// addEventListener 로 이름 붙여 넘긴 함수가 있는지
[...js.matchAll(/addEventListener\(\s*["'`]\w+["'`]\s*,\s*([A-Za-z_$][\w$]*)\s*\)/g)].forEach(m => { if (!fnDefined(m[1])) problems.push(`이벤트가 부르는 함수 ${m[1]} 가 없음`); });

// 4) 판 번호: index.html APP_VER = sw.js 캐시 이름 끝 번호, 업데이트 소식 최신판은 같은 큰 번호(앞 두 자리)
const appVer = (html.match(/const APP_VER\s*=\s*"([\d.]+)"/) || [])[1];
const swVer = (read("sw.js").match(/const CACHE\s*=\s*"[\w-]+-v([\d.]+)"/) || [])[1];
const newsVer = (html.match(/const NEWS\s*=\s*\[\s*\{\s*v:"([\d.]+)"/) || [])[1];
const mm = v => (v || "").split(".").slice(0, 2).join(".");
const cmp = (a, b) => { const x = a.split(".").map(Number), y = b.split(".").map(Number); for (let i = 0; i < 3; i++){ if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
if (!appVer) problems.push("index.html 에 APP_VER 가 없음");
if (!swVer) problems.push("sw.js 캐시 이름에서 판 번호를 못 찾음");
if (appVer && swVer && appVer !== swVer) problems.push(`판 번호가 다름: index.html ${appVer}, sw.js ${swVer}`);
if (appVer && newsVer){
  if (cmp(newsVer, appVer) > 0) problems.push(`업데이트 소식(${newsVer})이 앱 판 번호(${appVer})보다 높음`);
  else if (mm(newsVer) !== mm(appVer)) notes.push(`참고: 기능 판 번호는 ${appVer}인데 업데이트 소식 최신은 ${newsVer} (굵직한 기능이면 소식 적기)`);
}

fs.rmSync(tmp, {recursive: true, force: true});
if (problems.length){ console.log("코드 검사 실패"); problems.forEach(x => console.log(" - " + x)); process.exit(1); }
notes.forEach(x => console.log(x));
console.log(`코드 검사 통과 (판 ${appVer})`);
