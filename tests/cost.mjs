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
await p.evaluate(()=>{ const s=(id,v)=>{const e=document.getElementById(id); e.value=v; e.dispatchEvent(new Event("input",{bubbles:true}));}; s("tripStart","2026-11-13"); s("tripNights","2"); state.trip.place="오사카"; });
await p.click('.tabbar button[data-tab="plan"]'); await p.waitForTimeout(200);
async function add(t,title,cost,cur){ await p.fill("#planTime",t); await p.fill("#planTitle",title); await p.locator("#planCost").pressSequentially(cost); if(cur) await p.selectOption("#planCur",cur); await p.click("#planAdd .primary"); await p.waitForTimeout(100); }
await add("0930","공항 리무진","32000","원");
await add("1300","오사카성","1200","엔");
await add("1800","도톤보리 저녁","8400","엔");
await p.click('.mday[data-d="2"]'); await add("1000","유니버설","38000","엔");
check(await p.evaluate(()=>state.plans.length)===4,"일정 수");
check(await p.inputValue("#planCost")==="","비용칸 안 비워짐");
await p.click(".psettle-btn"); await p.waitForTimeout(200);
await p.fill("#psSplit","4"); await p.press("#psSplit","Tab"); await p.waitForTimeout(200);
const txt = await p.evaluate(()=>settleText()); console.log(txt);
check(/47,600엔/.test(txt) && /1인당 8,000원 \+ 11,900엔/.test(txt), "정산 계산 틀림");
// 고치기에서 비용 지우기
await p.click(".pedit"); await p.waitForTimeout(150); check(await p.inputValue("#planCost")==="38,000","편집 비용 안 채워짐");
await p.locator(".psettle").scrollIntoViewIfNeeded(); await p.screenshot({path:"cost_m.png"});
await p.click(".pcancel");
await p.click(".tcost-head"); await p.waitForTimeout(150);
await p.selectOption("#costKind","항공권"); await p.fill("#costTitle","4명 왕복"); await p.locator("#costAmt").pressSequentially("1200000"); await p.selectOption("#costCur","원"); await p.click("#costAdd .primary");
await p.selectOption("#costKind","숙박"); await p.locator("#costAmt").pressSequentially("60000"); await p.selectOption("#costCur","엔"); await p.click("#costAdd .primary");
const t2 = await p.evaluate(()=>settleText()); console.log(t2);
check(/합계: 1,232,000원 \+ 107,600엔/.test(t2), "공통 비용 합계 틀림");
await p.click(".tcedit"); await p.waitForTimeout(150); check(await p.inputValue("#costAmt")==="1,200,000","비용 고치기 값");
await p.locator(".tcost").scrollIntoViewIfNeeded(); await p.screenshot({path:"tc_m.png"});
await p.click(".tccancel");
await p.click(".tcdel"); check(await p.evaluate(()=>state.costs.length)===1,"비용 빼기");
await p.click("#undoBar button"); check(await p.evaluate(()=>state.costs.length)===2,"비용 되돌리기");
const d = await newPage(1280); await d.goto(`${PAGE}`); await d.waitForTimeout(400);
await d.evaluate(()=>{ state.trip.nights="2"; state.plans=[{id:"a",day:1,time:"09:30",title:"공항",memo:"",cost:32000,cur:"원"},{id:"b",day:1,time:"13:00",title:"오사카성",memo:"",cost:1200,cur:"엔"}]; save(); render(); });
await d.evaluate(()=>{state.costs=[{id:"x",kind:"숙박",title:"호텔 2박",cost:60000,cur:"엔"}]; save(); render();}); await d.click(".tcost-head"); await d.click(".psettle-btn"); await d.waitForTimeout(200); await (await d.$("#plans")).screenshot({path:"cost_pc.png"});
const t = await newPage(1000); await t.goto(`${PAGE}`); await t.waitForTimeout(400);
await t.evaluate(()=>{ state.plans=[{id:"a",day:1,time:"09:30",title:"공항",memo:"",cost:32000,cur:"원"}]; save(); render(); });
await (await t.$("#plans")).screenshot({path:"cost_mid.png"});
console.log(problems.join("\n")||"문제 없음"); await b.close();
