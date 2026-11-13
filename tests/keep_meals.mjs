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
await p.goto(`${PAGE}`); await p.waitForTimeout(700);
await p.click('.tabbar button[data-tab="set"]'); await p.waitForTimeout(150);
check(await p.locator("#clearMealSet").getAttribute("aria-pressed")==="true", "처음 값이 켜짐이 아님");
await p.click("#clearMealSet"); await p.waitForTimeout(100);
check(await p.evaluate(()=>state.f.keepMeals===true) && await p.locator("#clearMealSet").textContent()==="꺼짐", "끄기 안 됨");
await p.reload(); await p.waitForTimeout(600);
check(await p.evaluate(()=>state.f.keepMeals===true), "끈 설정이 저장 안 됨");
await p.evaluate(()=>{ const s=(id,v)=>{const e=document.getElementById(id); e.value=v; e.dispatchEvent(new Event("input",{bubbles:true}));}; s("tripStart","2026-11-20"); s("tripNights","1");
  addMeal(1,"저녁","라면","라면, 김치"); state.zones.find(z=>z.id==="shop").items.push({id:"s1",t:"얼음",g:[]}); state.checked[state.zones[0].items[0].id]=true; save(); render(); });
await p.click('.tabbar button[data-tab="log"]'); await p.click("#saveRec"); await p.waitForTimeout(400);
check(await p.evaluate(()=>Object.keys(state.checked).length===0), "끈 상태에서도 체크는 비워져야 함");
check(await p.evaluate(()=>state.meals.length===1 && state.zones.find(z=>z.id==="shop").items.length===1 && state.zones.flatMap(z=>z.items).some(i=>i.m)), "끈 상태인데 식단·장보기가 비워짐");
await p.click('.tabbar button[data-tab="set"]'); await p.locator("#clearMealSet").scrollIntoViewIfNeeded(); await p.screenshot({path:"keep_set.png"});
console.log(problems.join("\n")||"문제 없음"); await b.close();
