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
// 사용 안내: 단추 자리, 창 열기·항목 수·닫기(닫기·확인·Esc·바깥), 미리보기 링크, 휴대폰 너비 넘침
const N = isCam ? 8 : 8;
const p = await newPage(390, "light", true);
await p.goto(PAGE); await p.waitForTimeout(700);
check(await p.locator("header .ccq-help").isVisible(), "휴대폰 첫 화면 위에 사용 안내 단추 없음");
const bb = await p.locator("header .ccq-help").boundingBox();
check(bb && bb.height >= 44 && bb.x + bb.width <= 390 && bb.y < 80, "첫 화면 단추 자리·높이 이상: " + JSON.stringify(bb));
await p.click("header .ccq-help"); await p.waitForTimeout(200);
check(await p.locator("#helpModal").isVisible(), "사용 안내 창이 안 열림");
check(await p.locator("#helpTitle").textContent() === (isCam ? "캠첵!" : "트립첵!") + " 간략 사용법", "창 제목이 다름");
check(await p.locator("#helpBody section").count() === N, "항목 수가 다름: " + await p.locator("#helpBody section").count());
check(await p.locator("#helpDemo").isVisible(), "예시로 미리 눌러 보기 없음");
check(await p.evaluate(() => { const c = document.querySelector(".ccq-card"); return c.scrollWidth <= c.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1 && c.getBoundingClientRect().right <= innerWidth && c.getBoundingClientRect().left >= 0; }), "휴대폰에서 창이 옆으로 넘침");
check(await p.evaluate(() => { const c = document.querySelector(".ccq-card"); return c.getBoundingClientRect().height <= innerHeight; }), "창이 화면보다 김(안에서 스크롤 안 됨)");
await p.screenshot({path:`help_${app}_390.png`});
await p.keyboard.press("Escape"); await p.waitForTimeout(100);
check(await p.locator("#helpModal").isHidden(), "Esc로 안 닫힘");
await p.click("header .ccq-help"); await p.click("#helpOk"); check(await p.locator("#helpModal").isHidden(), "확인으로 안 닫힘");
await p.click("header .ccq-help"); await p.click("#helpClose"); check(await p.locator("#helpModal").isHidden(), "닫기로 안 닫힘");
await p.click("header .ccq-help"); await p.mouse.click(5, 5); check(await p.locator("#helpModal").isHidden(), "바깥 눌러도 안 닫힘");
// 설정 맨 위
await p.click('.tabbar button[data-tab="set"]'); await p.waitForTimeout(150);
check(await p.locator("#setTab .set-head .ccq-help").isVisible(), "설정 맨 위에 사용 안내 단추 없음");
await p.click("#setTab .ccq-help"); check(await p.locator("#helpModal").isVisible(), "설정의 단추로 창이 안 열림"); await p.keyboard.press("Escape");
check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "휴대폰 화면이 옆으로 넘침");
// 미리보기 안에서는 예시 링크 숨김
const q = await newPage(390); await q.goto(PAGE + "?demo"); await q.waitForTimeout(600);
await q.click("header .ccq-help"); check(await q.locator("#helpDemo").isHidden(), "미리보기 안인데 예시 링크가 보임");
// 컴퓨터: 머리 오른쪽 위
const d = await newPage(1280, "light", false, 800); await d.goto(PAGE); await d.waitForTimeout(600);
// PC(2단): 머리 단추는 숨고, "출발 체크" 줄 오른쪽 끝에 단추
check(await d.locator("header .ccq-help").isHidden(), "PC인데 머리에도 단추가 보임");
const db = await d.locator(".pc-help").boundingBox(), pb = await d.locator("#phase").boundingBox(), mb = await d.locator(".mainc").boundingBox();
check(db && db.height >= 44 && Math.abs((db.y + db.height / 2) - (pb.y + pb.height / 2)) <= 3 && Math.abs((db.x + db.width) - (mb.x + mb.width)) <= 2, "PC 단추가 출발 체크 줄 오른쪽 끝에 없음: " + JSON.stringify({db, pb, mb}));
await d.click(".pc-help"); await d.waitForTimeout(100); check(await d.locator("#helpModal").isVisible(), "PC 단추로 창이 안 열림"); await d.keyboard.press("Escape");
await d.screenshot({path:`help_${app}_1280.png`, clip:{x:0,y:0,width:1280,height:360}});
await d.click(".pc-help"); await d.waitForTimeout(150);
check(await d.locator("#helpBody section").count() === N, "컴퓨터에서 항목 수가 다름");
await d.screenshot({path:`help_${app}_1280_open.png`});
// 가운데 폭(태블릿 세로)
const t = await newPage(820, "light", true, 1100); await t.goto(PAGE); await t.waitForTimeout(500);
const tb = await t.locator("header .ccq-help").boundingBox(); check(tb && tb.height >= 44, "태블릿 단추 이상"); check(await t.locator(".pc-help").isHidden(), "태블릿에 PC 단추가 보임");
await t.screenshot({path:`help_${app}_820.png`, clip:{x:0,y:0,width:820,height:360}});
console.log(problems.join("\n") || "문제 없음"); await b.close();
