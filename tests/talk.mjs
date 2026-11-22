// 캠첵! · 트립첵! 시험 공통 머리말 (tests/make 로 만든 파일 — 고칠 때는 tests/_header.mjs 와 같이)
import fs from "fs";
import { createRequire } from "module";
import { fileURLToPath } from "url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");          // 이 컴퓨터에 깔린 playwright(NODE_PATH)
const D = fileURLToPath(new URL(".", import.meta.url)), ROOT = fileURLToPath(new URL("..", import.meta.url)), F = D + "node_modules/@fontsource";
const PAGE = "file://" + ROOT + "index.html";
const css = `@font-face{font-family:"Do Hyeon";src:url(file://${F}/do-hyeon/files/do-hyeon-korean-400-normal.woff2)}
@font-face{font-family:"Nanum Gothic";font-weight:400;src:url(file://${F}/nanum-gothic/files/nanum-gothic-korean-400-normal.woff2)}
@font-face{font-family:"Nanum Gothic";font-weight:700;src:url(file://${F}/nanum-gothic/files/nanum-gothic-korean-700-normal.woff2)}
@font-face{font-family:"Nanum Gothic";font-weight:800;src:url(file://${F}/nanum-gothic/files/nanum-gothic-korean-800-normal.woff2)}`;
const stub = `window.kakao={maps:{load:cb=>cb(),services:{Status:{OK:"OK",ZERO_RESULT:"ZERO_RESULT",ERROR:"ERROR"},Places:function(){this.keywordSearch=(q,cb)=>setTimeout(()=>cb([{id:"111",place_name:q+" 캠핑장",road_address_name:"전북 어딘가",place_url:"https://place.map.kakao.com/111",x:"126.85",y:"35.57"}],"OK"),30);},Geocoder:function(){this.addressSearch=(q,cb)=>setTimeout(()=>cb([],"ZERO_RESULT"),30);}}}};`;
const days = Array.from({length:16},(_,i)=>{const d=(()=>{const t=new Date();return new Date(t.getFullYear(),t.getMonth(),t.getDate()+i)})();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");});
const wx = JSON.stringify({daily:{time:days,temperature_2m_min:days.map(()=>3),temperature_2m_max:days.map(()=>14),weather_code:days.map(()=>61),precipitation_probability_max:days.map(()=>70),precipitation_sum:days.map(()=>6),wind_speed_10m_max:days.map(()=>9),wind_gusts_10m_max:days.map(()=>15)}});
const app = process.argv[2] || (fs.readFileSync(ROOT + "index.html", "utf8").includes("트립첵!</title>") ? "tripcheck" : "camping");
const isCam = app==="camping";
const problems = [];
const b = await chromium.launch();
async function newPage(vw, scheme="light", touch=false, vh=844){
  const ctx = await b.newContext({viewport:{width:vw,height:vh},deviceScaleFactor:1,colorScheme:scheme,permissions:["clipboard-read","clipboard-write"],hasTouch:touch,isMobile:touch});
  const p = await ctx.newPage();
  p.on("pageerror", e=>{ if (/app-firebase\.js|demo\.js|gstatic/.test(e.message)) return; problems.push(`[${vw}] JS오류: ${e.message}`); });   // 여기서는 파이어베이스 서버에 못 붙어서 그 오류만 뺌
  await p.route(/fonts\.googleapis/, r=>r.fulfill({contentType:"text/css",body:css}));
  await p.route(/qrcode\.min\.js/, r=>r.fulfill({contentType:"text/javascript",body:fs.readFileSync(D+"node_modules/qrcode-generator/qrcode.js")}));
  await p.route(/Sortable\.min\.js/, r=>r.fulfill({contentType:"text/javascript",body:fs.readFileSync(D+"node_modules/sortablejs/Sortable.min.js")}));
  await p.route(/dapi\.kakao\.com/, r=>r.fulfill({contentType:"text/javascript",body:stub}));
  await p.route(/api\.open-meteo\.com/, r=>r.fulfill({contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:wx}));
  await p.route(/geocoding-api/, r=>r.fulfill({contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify({results:[{name:"오사카",admin1:"오사카부",country:"일본",latitude:34.69,longitude:135.5}]})}));
  return p;
}
const check = (cond, msg) => { if (!cond) problems.push(msg); };
// 여행 회화: 자료 빠짐없음, 언어 자동 선택, 펼치기·발음·소리, 보여 주기(뒤집힘), 문장 만들기 결과, 닫기, 넘침
const p = await newPage(390, "light", true);
await p.addInitScript(() => {
  window.__spoken = []; window.__voices = [{lang:"ja-JP"},{lang:"en-US"},{lang:"fr-FR"},{lang:"th-TH"}];
  const ss = {speak: u => window.__spoken.push({t: u.text, lang: u.lang}), cancel(){}, getVoices: () => window.__voices, onvoiceschanged: null};
  Object.defineProperty(window, "speechSynthesis", {value: ss, configurable: true});
  window.SpeechSynthesisUtterance = function(t){ this.text = t; };
});
await p.goto(PAGE); await p.waitForTimeout(700);
// 자료 검사
const bad = await p.evaluate(() => {
  const T = window.TALK, L = T.langs.map(l => l.id), out = [];
  T.scenes.forEach(sc => sc.items.forEach(it => L.forEach(l => { const v = it[l]; if (!v || !v[0] || !v[1]) out.push(`${sc.name} "${it.ko}" ${l} 빠짐`); })));
  T.tpls.filter(t => !t.count).forEach(t => L.forEach(l => { if (!t[l] || !t[l][0].includes("{X}") || !t[l][1].includes("{x}")) out.push(`틀 ${t.ko} ${l} 이상`); }));
  Object.entries(T.groups).forEach(([g, grp]) => grp.words.forEach(w => L.forEach(l => {
    const f = w[l], need = g === "drink" ? ({ja:2, zh:4, vi:4, th:4, en:4, fr:5, es:5, it:5})[l] : 2;
    if (!f || f.length < need || f.some(x => !x)) out.push(`낱말 ${g} ${w.ko} ${l} 이상`);
  })));
  return out;
});
check(bad.length === 0, "회화 자료 빠짐: " + bad.slice(0, 5).join(" / "));
await p.evaluate(() => { state.trip.place = "오사카"; save(); render(); });
await p.click('.tabbar button[data-tab="plan"]'); await p.waitForTimeout(200);
check(await p.locator(".talk-open").isVisible(), "일정에 여행 회화 단추 없음");
check((await p.locator(".talk-open .tko-lang").textContent()).includes("일본어"), "오사카인데 일본어가 아님");
await p.click(".talk-open"); await p.waitForTimeout(200);
check(await p.locator("#talk").isVisible(), "여행 회화 창이 안 열림");
check(await p.inputValue("#talkLang") === "ja", "언어 자동 선택 안 됨");
check(await p.locator("#talkTabs button").count() === 7, "상황 탭 수가 다름");
check(await p.locator("#talkBody .tk-card").count() === 6, "공항 문장 수가 다름");
await p.click('#talkTabs button[data-sc="2"]'); await p.waitForTimeout(100);
check(await p.locator("#talkBody .tk-card").count() === 7, "식당 문장 수가 다름");
await p.click('#talkBody [data-tki="5"]'); await p.waitForTimeout(100);
check((await p.locator(".tk-card.open .tk-say").textContent()) === "오카이케- 오네가이시마스", "펼친 발음이 다름");
check(await p.locator("#talkShow").isHidden(), "보여 주기가 저절로 열림");
await p.click('.tk-card.open [data-tkact="say"]');
const sp = await p.evaluate(() => window.__spoken.at(-1));
check(sp && sp.lang === "ja-JP" && sp.t === "お会計お願いします。", "소리 듣기 내용이 다름: " + JSON.stringify(sp));
await p.screenshot({path:"talk_list.png"});
await p.click('.tk-card.open [data-tkact="show"]'); await p.waitForTimeout(150);
check(await p.locator("#talkShow").isVisible(), "보여 주기가 안 열림");
check(await p.evaluate(() => getComputedStyle(document.querySelector(".tk-them")).transform.startsWith("matrix(-1")), "상대 쪽이 뒤집히지 않음");
check(await p.locator("#talkBig").textContent() === "お会計お願いします。", "보여 주기 글자가 다름");
// 상대가 눌러 주는 대답
check(await p.locator("#talkAnsBtns [data-ans]").count() === 8, "대답 단추 수가 다름");
check(await p.locator("#talkAsk").textContent() === "答えを押してください", "상대 쪽 안내가 일본어가 아님");
check(await p.locator("#talkReply").isHidden(), "대답 전인데 답 칸이 보임");
await p.click('#talkAnsBtns [data-ans="have"]'); await p.waitForTimeout(80);
check(await p.locator("#talkReplyKo").textContent() === "있어요" && await p.locator("#talkReplyFx").textContent() === "あります", "대답이 한국어로 안 나옴");
check(await p.evaluate(() => { const t = document.querySelector(".tk-them"); return t.scrollHeight <= t.clientHeight + 1; }), "상대 쪽 대답 단추가 절반 화면을 넘침");
await p.screenshot({path:"talk_show.png"});
await p.keyboard.press("Escape"); await p.waitForTimeout(100);
check(await p.locator("#talkShow").isHidden() && await p.locator("#talk").isVisible(), "Esc 한 번에 보여 주기만 닫혀야 함");
// 값 묻기: 숫자판
await p.click('#talkTabs button[data-sc="4"]'); await p.click('#talkBody [data-tki="0"]'); await p.click('.tk-card.open [data-tkact="show"]'); await p.waitForTimeout(100);
check(await p.locator("#talkAnsBtns [data-key]").count() === 12, "얼마예요에 숫자판이 없음");
for (const k of ["1","2","0","0"]) await p.click(`#talkAnsBtns [data-key="${k}"]`);
check(await p.locator("#talkReplyKo").textContent() === "1,200", "적은 금액이 내 쪽에 안 나옴");
await p.click('#talkAnsBtns [data-key="⌫"]'); check(await p.locator("#talkReplyKo").textContent() === "120", "지우기 안 됨");
check(await p.evaluate(() => { const t = document.querySelector(".tk-them"); return t.scrollHeight <= t.clientHeight + 1; }), "숫자판이 절반 화면을 넘침");
await p.screenshot({path:"talk_num.png"});
await p.click("#talkShowClose");
// 문장 만들기
await p.click('#talkTabs button[data-sc="make"]'); await p.waitForTimeout(100);
const build = async (lang, t, w, n) => {
  await p.selectOption("#talkLang", lang); await p.waitForTimeout(50);
  await p.click(`[data-tkt="${t}"]`); await p.click(`[data-tkw="${w}"]`); if (n) await p.click(`[data-tkn="${n}"]`);
  return (await p.locator(".tk-out .tk-fx").textContent()).trim();
};
const exp = [
  ["ja",1,1,2,"ビールを二つください。"], ["fr",1,1,2,"Deux bières, s'il vous plaît."], ["fr",1,1,1,"Une bière, s'il vous plaît."],
  ["it",1,1,2,"Due birre, per favore."], ["es",1,2,1,"Un café, por favor."], ["en",1,0,1,"One bottle of water, please."],
  ["zh",1,1,2,"请给我两瓶啤酒。"], ["vi",1,1,2,"Cho tôi hai chai bia."],
  ["fr",3,0,0,"Où sont les toilettes ?"], ["es",3,0,0,"¿Dónde está el baño?"], ["it",3,0,0,"Dov'è il bagno?"], ["en",3,1,0,"Where is the station?"],
  ["ja",0,1,0,"ビールをください。"], ["en",2,1,0,"Do you have beer?"], ["fr",5,1,0,"Sans glaçons, s'il vous plaît."], ["zh",4,0,0,"这个多少钱？"]
];
for (const [l, t, w, n, want] of exp){ const got = await build(l, t, w, n); check(got === want, `문장 만들기 ${l}: "${got}" ≠ "${want}"`); }
// 길 묻기: 방향 대답(프랑스어)
await p.selectOption("#talkLang", "fr"); await p.click('[data-tkt="3"]'); await p.click('[data-tkw="1"]'); await p.click('[data-tkact="show"]'); await p.waitForTimeout(80);
await p.click('#talkAnsBtns [data-ans="right"]');
check(await p.locator("#talkReplyKo").textContent() === "오른쪽이에요" && await p.locator("#talkReplyFx").textContent() === "À droite", "길 대답이 다름");
await p.click("#talkShowClose");
// 태국어 여자 말끝
await p.selectOption("#talkLang", "th"); await p.click('#talkTh [data-g="f"]'); await p.click('[data-tkt="1"]'); await p.click('[data-tkw="1"]'); await p.click('[data-tkn="2"]');
check((await p.locator(".tk-out .tk-fx").textContent()).trim() === "ขอเบียร์ สอง ขวดค่ะ", "태국어 여자 말끝이 안 바뀜");
check(!(await p.locator("#talkBody").textContent()).includes("{"), "바꾸지 않은 자리표시 {P}가 보임");
await p.screenshot({path:"talk_make.png"});
// 목소리 없는 언어
await p.selectOption("#talkLang", "vi"); await p.click('[data-tkt="0"]'); await p.click('[data-tkw="0"]');
const before = await p.evaluate(() => window.__spoken.length);
await p.click('[data-tkact="say"]'); await p.waitForTimeout(100);
check(await p.evaluate(n => window.__spoken.length === n, before), "목소리가 없는데 읽으려 함");
// 고른 언어 기억(같은 여행지)
await p.selectOption("#talkLang", "fr"); await p.keyboard.press("Escape"); await p.waitForTimeout(100);
check(await p.locator("#talk").isHidden(), "Esc로 여행 회화가 안 닫힘");
check((await p.locator(".talk-open .tko-lang").textContent()).includes("프랑스어"), "고른 언어가 일정 단추에 안 보임");
await p.click(".talk-open"); check(await p.inputValue("#talkLang") === "fr", "고른 언어를 기억 못 함"); await p.click("#talkBack");
check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "휴대폰 화면이 옆으로 넘침");
// 여행지가 바뀌면 다시 추측
await p.evaluate(() => { state.trip.place = "다낭"; save(); render(); }); await p.click(".talk-open");
check(await p.inputValue("#talkLang") === "vi", "다낭인데 베트남어가 아님");
check(await p.evaluate(() => { const b = document.getElementById("talkBody"); return b.scrollWidth <= b.clientWidth + 1; }), "회화 창이 옆으로 넘침");
await p.click("#talkBack");
// 예전 자료 파일이 남아 있어도(대답 자료 없음) 보여 주기는 열려야 함
const o = await newPage(390, "light", true);
await o.route(/talk-data\.js/, async r => { const res = await r.fetch().catch(() => null); let body = fs.readFileSync(ROOT + "talk-data.js", "utf8").replace(/\n  answers: \{[\s\S]*?\n  \},\n  answerSets: \{[\s\S]*?\n  \},\n  \/\* 상대 쪽 안내 글 \*\/\n  ask: \{[\s\S]*?\n  \},\n/, "\n"); r.fulfill({contentType:"text/javascript", body}); });
await o.goto(PAGE); await o.waitForTimeout(600);
check(await o.evaluate(() => !window.TALK.answerSets), "예전 자료 흉내가 안 됨");
await o.click('.tabbar button[data-tab="plan"]'); await o.click(".talk-open"); await o.click('#talkBody [data-tki="0"]'); await o.click('.tk-card.open [data-tkact="show"]'); await o.waitForTimeout(150);
check(await o.locator("#talkShow").isVisible(), "예전 자료일 때 보여 주기가 안 열림");
// 컴퓨터: 가운데 좁은 창
const d = await newPage(1280, "light", false, 800); await d.goto(PAGE); await d.waitForTimeout(600);
await d.click(".talk-open"); const tb = await d.locator("#talk").boundingBox();
check(tb && tb.width <= 560 && Math.abs((tb.x + tb.width / 2) - 640) < 4, "컴퓨터에서 회화 창 위치 이상");
console.log(problems.join("\n") || "문제 없음"); await b.close();
