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
const p = await newPage(390);
await p.goto(`${PAGE}`); await p.waitForTimeout(600);
await p.evaluate(()=>{ addMeal(1,"저녁","떡볶이","떡, 어묵"); const fz=state.zones.find(z=>z.id==="food"); state.checked[fz.items[0].id]=true; save(); render(); });
check(await p.locator("#grid .is-food").first().isHidden(), "체크 탭에 먹거리 보임");
check(await p.locator("#grid .food-link").isVisible(), "바로가기 안 보임");
console.log(await p.locator(".food-link .fl-n").textContent());
await p.locator("#grid .food-link").scrollIntoViewIfNeeded(); await p.screenshot({path:"f_home.png"});
await p.click("#grid .food-link"); await p.waitForTimeout(700);
check(await p.evaluate(()=>document.body.dataset.tab)==="meal", "탭 안 바뀜");
check(await p.locator("#grid .is-food").first().isVisible(), "식단 탭에 먹거리 안 보임");
check(await p.locator("#grid .zone:not(.is-food)").first().isHidden(), "다른 구역도 보임");
await p.evaluate(()=>scrollTo(0,document.body.scrollHeight)); await p.waitForTimeout(200); await p.screenshot({path:"f_meal.png"});
// 식단 탭에서 체크
const cb = p.locator('#grid .is-food li input[type=checkbox]').nth(1); await cb.check();
check(await p.evaluate(()=>{const fz=state.zones.find(z=>z.id==="food"); return !!state.checked[fz.items[1].id];}), "식단 탭에서 체크 안 됨");
// 철수
await p.click('.tabbar button[data-tab="home"]'); await p.click('#phase button[data-ph="back"]'); await p.waitForTimeout(200);
check(await p.locator("#grid .food-link").count()===0, "철수에 바로가기 남음");
const zs = await p.evaluate(()=>state.zones.map(z=>z.id).join(","));
check(/food,shop/.test(zs), "장보기 구역이 먹거리 아래에 없음: "+zs);
// 예전 목록(장보기 없음)에서 옮겨 오기
const o = await newPage(390);
await o.goto(`${PAGE}`); await o.waitForTimeout(400);
await o.evaluate(()=>{ const s=JSON.parse(JSON.stringify(state)); s.zones=s.zones.filter(z=>z.id!=="shop"); s.zones.find(z=>z.id==="food").sub="장보기 목록"; s.f={hide:false}; localStorage.setItem("campfb-checklist-v1", JSON.stringify(s)); });
await o.reload(); await o.waitForTimeout(500);
const mz = await o.evaluate(()=>({ids:state.zones.map(z=>z.id).join(","), sub:state.zones.find(z=>z.id==="food").sub}));
check(/food,shop/.test(mz.ids) && mz.sub!=="장보기 목록", "예전 목록에 장보기 안 들어감 "+JSON.stringify(mz));
// 지우면 다시 안 생김
await o.evaluate(()=>{ state.zones=state.zones.filter(z=>z.id!=="shop"); save(); });
await o.waitForTimeout(900); await o.reload(); await o.waitForTimeout(500);
check(!(await o.evaluate(()=>state.zones.some(z=>z.id==="shop"))), "지운 장보기가 다시 생김");
await o.click('.tabbar button[data-tab="meal"]'); await o.waitForTimeout(200);
const d = await newPage(1280); await d.goto(`${PAGE}`); await d.waitForTimeout(500);
await d.screenshot({path:"f_pc.png", fullPage:true});
check(await d.locator("#grid .food-link").isHidden() && await d.locator("#grid .is-food").first().isVisible(), "PC 화면 달라짐");
console.log(problems.join("\n")||"문제 없음"); await b.close();
