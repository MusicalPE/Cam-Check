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
// ---------- 휴대폰, 가족 공간 흉내 ----------
const p = await newPage(390);
await p.goto(`${PAGE}`); await p.waitForTimeout(700);
const remoteLog = [];
await p.exposeFunction("__log", x=>remoteLog.push(x));
await p.evaluate(()=>{ const ok=(...a)=>{__log(a.map(String).join(" ")); return Promise.resolve();};
  window.FBAPP={login:async()=>{},logout(){},putShare:async(d,a)=>{window.__share=d;return "abc1234";},getShare:async()=>({d:window.__share})};
  CAMP.setAccount({phase:"nofamily",user:{uid:"u",name:"테스트"}});
  CAMP.enterFamily({id:"F",name:"햇살이네",invite:"inv",members:[{uid:"u",name:"테스트"},{uid:"v",name:"가족"}]},
   {saveSettings:o=>ok("save",Object.keys(o).join(",")),check:(i,o)=>ok("check",i,o),checkBack:(i,o)=>ok("back",i,o),clearChecks:()=>ok("clear"),clearGo:()=>ok("clearGo"),clearBack:()=>ok("clearBack"),addRecord:r=>ok("addRecord",JSON.stringify(r).slice(0,80)),deleteRecord:()=>ok("del"),updateRecord:()=>ok("upd")}); });
// 체크
await p.locator('#grid .zone >> nth=0 >> input[type=checkbox] >> nth=0').check();
check(remoteLog.some(x=>x.startsWith("check")), "체크가 가족 공간으로 안 감");
const cap1 = await p.locator("#totalCap").textContent();
check(/남은/.test(cap1), "남은 개수 표시 이상: "+cap1);
// 강조 켜기
await p.locator('#grid .zone >> nth=0 >> li >> nth=1 >> .pen:not(.trash)').click(); await p.click(".qimp"); await p.click(".qsave");
check(await p.locator("li.imp").count()===1+(isCam?0:3)||await p.locator("li.imp").count()>=1, "꼭! 강조 안 됨");
// 접기
await p.locator('#grid .zone >> nth=0 >> .zfold >> nth=0').click(); check(await p.locator("#grid .zone.folded").count()===1, "구역 접기 안 됨"); await p.locator('#grid .zone >> nth=0 >> .zfold >> nth=0').click();
// 상황 버튼
const chip = p.locator("#labelChips .lchip").first(); const before = await p.locator("#grid .zone").count(); await chip.click(); await chip.click();
check(await p.locator("#grid .zone").count()===before, "상황 버튼 두 번 누른 뒤 구역 수가 달라짐");
// 철수
await p.click('#phase button[data-ph="back"]');
check(/다시/.test(await p.locator("#totalCap").textContent()), "철수 문구 안 바뀜");
await p.locator('#grid .zone >> nth=0 >> input[type=checkbox] >> nth=0').check();
check(remoteLog.some(x=>x.startsWith("back")), "철수 체크가 가족 공간으로 안 감");
await p.click('#phase button[data-ph="go"]');
// 빼기 + 되돌리기
const n0 = await p.evaluate(()=>state.zones[0].items.length);
await p.locator('#grid .zone >> nth=0 >> li >> nth=2 >> .trash').click(); await p.click(".tyes");
await p.click("#undoBar button"); check(await p.evaluate(()=>state.zones[0].items.length)===n0, "되돌리기 안 됨");
// 위쪽 정보 + 장소 + 날씨
await p.fill("#tripStart",days[3]); await p.fill("#tripNights","1"); await p.fill("#tripPlace","노을"); await p.waitForTimeout(500); await p.press("#tripPlace","Enter"); await p.waitForTimeout(900);
check(await p.locator(".wx-table td.warn").count()>0, "날씨 표가 안 채워짐");
check((await p.locator("#placeLinks").innerText()).includes("카카오맵"), "장소 링크 없음");
// 탭
const tabs = isCam ? ["log","meal","fam","set","home"] : ["log","plan","fam","set","home"];
for (const t of tabs){ await p.click(`.tabbar button[data-tab="${t}"]`); await p.waitForTimeout(120); await p.screenshot({path:`qa_${app}_${t}.png`}); }
// 식단/일정
await p.click(`.tabbar button[data-tab="${isCam?"meal":"plan"}"]`);
if (isCam){ await p.fill("#mealMenu","라볶이"); await p.fill("#mealIng","떡, 어묵"); await p.click("#mealAdd .primary");
  check(await p.evaluate(()=>state.zones.some(z=>z.items.some(i=>i.t==="어묵"&&i.m))), "식단 재료가 먹거리에 안 들어감"); }
else { await p.fill("#planTime","09:00"); await p.fill("#planTitle","공항"); await p.click("#planAdd .primary");
  check(await p.locator(".plan").count()===1, "일정이 안 들어감"); }
check(remoteLog.some(x=>x.includes(isCam?"meals":"plans")), "식단/일정이 가족 공간 저장 항목에 없음");
// 기록
const ckBefore = await p.evaluate(()=>Object.keys(state.checked).length);
if (isCam) await p.evaluate(()=>{ const sh=state.zones.find(z=>z.id==="shop"); sh.items.push({id:"sh1",t:"얼음",g:[]}); save(); });
const mealBefore = isCam ? await p.evaluate(()=>({n:state.meals.length, m:state.zones.flatMap(z=>z.items).filter(i=>i.m).length, sh:state.zones.find(z=>z.id==="shop").items.length})) : null;
await p.click('.tabbar button[data-tab="log"]'); await p.click("#saveRec"); await p.waitForTimeout(300);
check(remoteLog.some(x=>x.startsWith("addRecord")), "기록 저장 안 됨");
check(ckBefore>0 && await p.evaluate(()=>Object.keys(state.checked).length===0 && Object.keys(state.back||{}).length===0 && !state.trip.start), "기록 후 체크가 안 비워짐");
check(remoteLog.some(x=>x==="clear"), "기록 후 비우기가 가족 공간에 안 감");
if (isCam){ check(mealBefore.n>0 && mealBefore.m>0, "시험용 식단이 없음"); check(await p.evaluate(()=>state.meals.length===0 && !state.zones.flatMap(z=>z.items).some(i=>i.m)), "기록 후 식단·식단 재료가 안 비워짐");  check(await p.evaluate(()=>{const sh=state.zones.find(z=>z.id==="shop"); return !!sh && sh.items.length===0;}), "장보기 칸이 안 비워졌거나 구역이 사라짐"); }
await p.click("#undoBar button"); await p.waitForTimeout(200);
check(await p.evaluate(()=>Object.keys(state.checked).length)===ckBefore && await p.evaluate(()=>!!state.trip.start), "기록 후 비우기 되돌리기 안 됨");
if (isCam) check(await p.evaluate(()=>state.meals.length)===mealBefore.n && await p.evaluate(()=>state.zones.flatMap(z=>z.items).filter(i=>i.m).length)===mealBefore.m, "식단 되돌리기 안 됨");
if (isCam) check(await p.evaluate(()=>state.zones.find(z=>z.id==="shop").items.length)===mealBefore.sh, "장보기 되돌리기 안 됨");
// 세팅 공유 보내기/받기
await p.click('.tabbar button[data-tab="set"]'); await p.click("#shareSet"); await p.click("#shareMake"); await p.waitForTimeout(300);
check(await p.locator(".share-qr svg").count()===1, "공유 QR 안 나옴"); await p.click("#shareClose");
// 업데이트 소식
await p.click("#newsSet"); check(await p.locator(".news-item").count()>=2, "업데이트 소식 비어 있음"); await p.click("#newsClose");
// 가족 QR
await p.click('.tabbar button[data-tab="fam"]'); await p.waitForTimeout(150); check(await p.locator("#famTabBody svg").count()>=1, "가족 탭 QR 없음");
// 가족 쪽에서 바뀐 내용이 들어올 때
await p.click('.tabbar button[data-tab="home"]'); await p.evaluate(()=>document.activeElement && document.activeElement.blur());
await p.waitForTimeout(900);
await p.evaluate(()=>{ const d=JSON.parse(JSON.stringify(settingsObj())); d.zones[0].items.push({id:"zz",t:"원격 항목",g:[]}); d.checked={zz:true}; d.back={}; CAMP.applyFamily(d); });
await p.waitForTimeout(300);
check(await p.evaluate(()=>state.zones[0].items.some(i=>i.t==="원격 항목")), "가족이 바꾼 내용이 안 들어옴");
// 가로 넘침
for (const t of ["home"]){ const over = await p.evaluate(()=>document.documentElement.scrollWidth - innerWidth); check(over<=1, `휴대폰 가로로 넘침 ${over}px`); }
// ---------- 컴퓨터 + 어두운 화면 ----------
const q = await newPage(1280,"dark");
await q.goto(`${PAGE}`); await q.waitForTimeout(700);
await q.screenshot({path:`qa_${app}_dark_desktop.png`});
const over2 = await q.evaluate(()=>document.documentElement.scrollWidth - innerWidth); check(over2<=1, `컴퓨터 가로로 넘침 ${over2}px`);
const qm = await newPage(390,"dark"); await qm.goto(`${PAGE}`); await qm.waitForTimeout(600); await qm.screenshot({path:`qa_${app}_dark_mobile.png`});
// 로그인 안 한 상태, 오프라인 느낌
const r = await newPage(390); await r.goto(`${PAGE}`); await r.waitForTimeout(500);
await r.evaluate(()=>CAMP.setAccount({phase:"out"})); await r.click('.tabbar button[data-tab="fam"]'); await r.waitForTimeout(150); await r.screenshot({path:`qa_${app}_out_fam.png`});
console.log(app, problems.length ? "문제:\n - "+problems.join("\n - ") : "문제 없음");
await b.close();
