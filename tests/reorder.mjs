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
  p.on("pageerror", e=>{ if (/app-firebase\.js|gstatic/.test(e.message)) return; problems.push(`[${vw}] JS오류: ${e.message}`); });   // 여기서는 파이어베이스 서버에 못 붙어서 그 오류만 뺌
  await p.route(/fonts\.googleapis/, r=>r.fulfill({contentType:"text/css",body:css}));
  await p.route(/qrcode\.min\.js/, r=>r.fulfill({contentType:"text/javascript",body:fs.readFileSync(D+"node_modules/qrcode-generator/qrcode.js")}));
  await p.route(/Sortable\.min\.js/, r=>r.fulfill({contentType:"text/javascript",body:fs.readFileSync(D+"node_modules/sortablejs/Sortable.min.js")}));
  await p.route(/dapi\.kakao\.com/, r=>r.fulfill({contentType:"text/javascript",body:stub}));
  await p.route(/api\.open-meteo\.com/, r=>r.fulfill({contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:wx}));
  await p.route(/geocoding-api/, r=>r.fulfill({contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify({results:[{name:"오사카",admin1:"오사카부",country:"일본",latitude:34.69,longitude:135.5}]})}));
  return p;
}
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const p = await newPage(390, "light", true);
await p.goto(`${PAGE}`); await p.waitForTimeout(700);
check(await p.evaluate(()=>matchMedia("(pointer:coarse)").matches), "터치 흉내가 안 됨");
check(await p.locator("#reorderBtn").isVisible(), "휴대폰에 순서 편집 버튼 없음");
check(await p.locator("#grid li[data-i] .grip").first().isHidden(), "편집 전인데 손잡이 보임");
check(await p.evaluate(()=>!Sortable.get(document.querySelector("#grid ul.items")) && !gridSort), "편집 전인데 끌기가 켜져 있음");
// 스크롤 흉내: 항목 위에서 손가락 끌기 → 순서 그대로
const before = await p.evaluate(()=>state.zones[0].items.map(i=>i.id).join());
const li = await p.locator("#grid li[data-i]").first().boundingBox();
await p.touchscreen.tap(li.x+20, li.y+10).catch(()=>{});
await p.evaluate(()=>scrollBy(0,300));
check(await p.evaluate(()=>state.zones[0].items.map(i=>i.id).join())===before, "편집 전에 순서가 바뀜");
await p.evaluate(()=>scrollTo(0,0));
await p.click("#reorderBtn"); await p.waitForTimeout(200);
check(await p.locator("#grid li[data-i] .grip").first().isVisible(), "편집 중인데 손잡이 안 보임");
check(await p.evaluate(()=>!!Sortable.get(document.querySelector("#grid ul.items")) && !!gridSort), "편집 중인데 끌기가 안 켜짐");
check(await p.locator("#reorderDone").isVisible(), "끝내기 버튼 없음");
// 편집 중 다른 동작으로 다시 그려도 계속 켜짐
await p.locator("#grid li[data-i] input[type=checkbox]").nth(1).check(); await p.waitForTimeout(150);
check(await p.evaluate(()=>!!Sortable.get(document.querySelector("#grid ul.items"))), "다시 그린 뒤 끌기가 꺼짐");
// 순서 바꾸기(코드로 끌기 결과 흉내)
await p.screenshot({path:`reo_${app}.png`});
await p.click("#reorderDone"); await p.waitForTimeout(200);
check(await p.locator("#grid li[data-i] .grip").first().isHidden() && await p.evaluate(()=>!gridSort), "끝내기 후에도 편집 상태");
// 컴퓨터: 버튼 없이 원래처럼
const d = await newPage(1280); await d.goto(`${PAGE}`); await d.waitForTimeout(600);
check(await d.locator("#reorderBtn").isHidden(), "컴퓨터에 순서 편집 버튼 보임");
check(await d.locator("#grid li[data-i] .grip").first().isVisible() && await d.evaluate(()=>!!gridSort), "컴퓨터에서 끌기가 꺼짐");
console.log(problems.join("\n")||"문제 없음"); await b.close();
