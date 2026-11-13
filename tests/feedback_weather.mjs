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
const p = await newPage(1280);
let calls = 0; p.on("request", r => { if (/api\.open-meteo\.com/.test(r.url())) calls++; });
await p.goto(`${PAGE}`); await p.waitForTimeout(1200);
const d0 = await p.evaluate(()=>{ const t=new Date(); t.setDate(t.getDate()+3); return t.toISOString().slice(0,10); });
await p.evaluate((d)=>{ state.trip.pinfo={id:"1",addr:"테스트",lat:35.8,lon:127.1}; state.trip.start=d; state.trip.nights="2"; save(); }, d0);
calls = 0;
await p.evaluate(async()=>{ await loadWeather(); await loadWeather(); await loadWeather(true); });
check(calls===1, "같은 장소 날씨를 여러 번 불러옴: "+calls);
check(await p.evaluate(()=>(state.trip.wx||[]).length>0), "캐시로 날씨 표가 안 채워짐");
await p.evaluate(async()=>{ state.trip.pinfo={id:"2",addr:"다른 곳",lat:37.5,lon:127.0}; await loadWeather(); });
check(calls===2, "다른 장소인데 안 불러옴: "+calls);
// 의견 보내기
await p.evaluate(()=>{ window.__fb=[]; window.FBAPP = Object.assign(window.FBAPP||{}, {sendFeedback: async o => { window.__fb.push(o); }}); });
await p.click("#fbFoot"); await p.waitForTimeout(150);
check(await p.locator("#fbModal").isVisible(), "의견 창 안 열림");
await p.click("#fbSend"); await p.waitForTimeout(100);
check(await p.evaluate(()=>window.__fb.length)===0, "빈 의견이 보내짐");
await p.fill("#fbText","철수 체크가 편해요"); await p.fill("#fbContact","a@b.c"); await p.click("#fbSend"); await p.waitForTimeout(200);
const fb = await p.evaluate(()=>window.__fb[0]); console.log(JSON.stringify(fb));
check(fb && fb.text==="철수 체크가 편해요" && fb.contact==="a@b.c" && fb.ver, "의견 내용이 이상함");
check(await p.locator("#fbModal").isHidden(), "보낸 뒤 창이 안 닫힘");
await p.click("#fbFoot"); await p.fill("#fbText","한 번 더"); await p.click("#fbSend"); await p.waitForTimeout(150);
check(await p.evaluate(()=>window.__fb.length)===1, "1분 안에 또 보내짐");
await p.click("#fbClose");
// 휴대폰 설정 탭에서 열기
const m = await newPage(390); await m.goto(`${PAGE}`); await m.waitForTimeout(600);
await m.click('.tabbar button[data-tab="set"]'); await m.waitForTimeout(150);
check(await m.locator("#fbSet").isVisible(), "휴대폰 설정에 의견 보내기 없음");
await m.click("#fbSet"); await m.waitForTimeout(200); await m.screenshot({path:`fb_${app}.png`});
console.log(problems.join("\n")||"문제 없음"); await b.close();
