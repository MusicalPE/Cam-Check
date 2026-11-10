/* 캠첵! 미리보기 (주소 끝에 ?demo)
   로그인 없이 지어낸 가족의 캠핑 준비 모습을 보여 줌.
   파이어베이스 대신 이 창 안에서만 움직이고, 새로고침하면 처음으로 돌아감.
   화면 쪽(index.html)과는 app-firebase.js 와 똑같이 window.CAMP 로 주고받음
   Made by 음악적체육인 */
const C = () => window.CAMP;
const clone = o => JSON.parse(JSON.stringify(o));
const ME = { uid: "demo-me", name: "엄마", email: "" };
const MEMBERS = [ME, { uid: "demo-2", name: "아빠" }, { uid: "demo-3", name: "첫째" }];
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysFrom = n => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
let seq = 0;
const nid = () => "d" + (++seq).toString(36);

/* ---------- 지어낸 가족의 캠핑 ---------- */
function buildFamily(){
  const zones = defaultZones();
  const z = id => zones.find(x => x.id === id);
  const food = z("food");
  const meals = [];
  const norm = t => String(t).replace(/\s+/g, "");
  function meal(day, slot, menu, ing){
    const m = { id: nid(), day, slot, menu, ing };
    meals.push(m);
    ing.forEach(t => {
      if (zones.some(zz => zz.items.some(i => norm(i.t) === norm(t)))) return;
      food.items.push({ id: nid(), t, g: [], m: m.id });
    });
  }
  meal(1, "점심", "김밥 · 컵라면", ["김밥", "컵라면"]);
  meal(1, "저녁", "삼겹살 구이", ["삼겹살", "쌈채소", "쌈장", "버섯"]);
  meal(1, "간식", "불멍 마시멜로", ["마시멜로", "꼬치"]);
  meal(2, "아침", "누룽지 · 계란", ["누룽지", "계란"]);
  meal(2, "점심", "부대찌개", ["부대찌개 밀키트", "라면사리"]);
  meal(2, "저녁", "어묵탕 · 주먹밥", ["어묵", "김가루", "단무지"]);
  meal(3, "아침", "토스트 · 우유", ["식빵", "딸기잼", "우유"]);

  const shop = { id: "shop", name: "장보기", sub: "가기 전에 마트에서 살 것", g: [], items: [
    { id: nid(), t: "장작 2망", g: [] }, { id: nid(), t: "얼음", g: [] }, { id: nid(), t: "건전지(랜턴용)", g: [] }] };
  zones.splice(zones.indexOf(food) + 1, 0, shop);

  /* 반쯤 챙긴 모습: 사이트 · 침실 · 거실은 거의 다, 주방 · 먹거리는 아직 */
  const checked = {};
  const done = { site: 1, car: 0.6, bed: 0.85, power: 0.7, living: 1, kitchen: 0.55, fire: 0.5, food: 0.25, shop: 0.34, personal: 0.4, fun: 0.5 };
  zones.forEach(zz => {
    const r = done[zz.id] || 0, n = Math.round(zz.items.length * r);
    zz.items.slice(0, n).forEach(i => { checked[i.id] = true; });
  });

  return {
    name: "숲속 다람쥐네",
    zones, labels: DEFAULT_LABELS.map(l => Object.assign({}, l)), meals,
    trip: { start: ymd(daysFrom(4)), nights: "2", place: "솔바람 오토캠핑장 (예시)",
            pinfo: { id: "", addr: "경기 가평군 (예시)", url: "", lat: 37.83, lon: 127.51 } },
    memo: "개수대가 멀어서 설거지통 꼭 챙기기. 첫째 생일이라 케이크 초!",
    f: { hide: false, shop: true }, checked, back: {}
  };
}

function buildRecords(){
  const rec = (ago, nights, place, rating, temp, tempHi, memo, missed, got, total) =>
    ({ id: nid(), date: ymd(daysFrom(-ago)), nights: String(nights), place, rating, temp, tempHi, memo, missed, got, total,
       addr: "", placeUrl: "", placeId: "", saved: ymd(daysFrom(-ago + nights)) + " 18:20" });
  return [
    rec(24, 2, "별빛 계곡 캠핑장 (예시)", 4.5, "6℃", "17℃", "계곡 물소리가 좋았음. 밤에 생각보다 추워서 핫팩 다 씀.", ["핫팩", "털모자 · 장갑"], 71, 74),
    rec(52, 1, "바닷가 소나무 캠핑장 (예시)", 4, "18℃", "27℃", "바람이 세서 타프 스트링 두 번 더 묶음.", ["모기 기피제 · 모기향"], 66, 67),
    rec(95, 2, "솔숲 오토캠핑장 (예시)", 3.5, "21℃", "31℃", "화장실은 깨끗한데 사이트 간격이 좁음.", ["선풍기 · 서큘레이터", "얼음 · 아이스팩"], 63, 66),
    rec(160, 1, "호숫가 차박지 (예시)", 5, "9℃", "19℃", "차박 첫 도전! 평탄화 매트 최고.", ["핫팩", "랜턴 걸이 · 스탠드"], 58, 61)
  ];
}

/* ---------- 파이어베이스 대신 ---------- */
const doc = buildFamily();
let records = buildRecords();
const sortRecs = l => l.sort((a, b) => (b.date + b.saved).localeCompare(a.date + a.saved));
const pushRecords = () => C().applyRecords(clone(sortRecs(records)));
const later = v => new Promise(res => setTimeout(() => res(v), 120));
const famInfo = () => ({ id: "demo", name: doc.name, invite: "demo", members: MEMBERS.map(m => ({ uid: m.uid, name: m.name })) });
const notHere = what => { window.toast && window.toast(`미리보기에서는 ${what}를 할 수 없어요.`); return Promise.resolve(); };

const remote = {
  saveSettings: obj => { Object.assign(doc, clone(obj)); return later(); },
  check: (id, on) => { if (on) doc.checked[id] = true; else delete doc.checked[id]; return later(); },
  checkBack: (id, on) => { if (on) doc.back[id] = true; else delete doc.back[id]; return later(); },
  clearChecks: () => { doc.checked = {}; doc.back = {}; return later(); },
  clearGo: () => { doc.checked = {}; return later(); },
  clearBack: () => { doc.back = {}; return later(); },
  addRecord: rec => { records.push(Object.assign(clone(rec), { id: nid(), by: ME.uid })); return later().then(pushRecords); },
  deleteRecord: rid => { records = records.filter(r => r.id !== rid); return later().then(pushRecords); },
  updateRecord: (rid, f) => { records = records.map(r => r.id === rid ? Object.assign({}, r, clone(f)) : r); return later().then(pushRecords); }
};

window.FBAPP = {
  login: () => notHere("로그인"),
  logout: () => notHere("로그아웃"),
  leaveFamily: () => notHere("가족 공간 나가기"),
  deleteAccount: () => Promise.reject(new Error("미리보기에서는 계정을 지울 수 없어요.")),
  putShare: () => Promise.reject(new Error("미리보기에서는 공유 링크를 만들 수 없어요.")),
  getShare: () => Promise.resolve(null),
  createFamily: () => notHere("가족 공간 만들기")
};
window.COMMUNITY = { stat: () => undefined, want: (p, cb) => { cb && cb(); }, publish: () => Promise.resolve() };

/* ---------- 미리보기 안내 ---------- */
(function note(){
  const bar = document.createElement("div");
  bar.setAttribute("role", "note");
  bar.style.cssText = "background:#FFF4D6;color:#5C4510;font-size:13px;line-height:1.55;text-align:center;" +
    "padding:9px max(16px,env(safe-area-inset-right,0px)) 9px max(16px,env(safe-area-inset-left,0px))";
  bar.innerHTML = '<b style="color:#3F2F08">미리보기</b> · 지어낸 가족의 캠핑 준비 모습이에요. 눌러 봐도 저장되지 않고 새로고침하면 처음으로 돌아가요. ' +
    '<a href="./" style="color:#2F5D4E;font-weight:700;white-space:nowrap">내 캠첵 시작하기</a>';
  document.body.insertBefore(bar, document.body.firstChild);
})();

C().setAccount({ phase: "loading", user: ME });
setTimeout(() => {
  C().enterFamily(famInfo(), remote);
  C().applyFamily(clone(doc));
  pushRecords();
  C().showConnState();
}, 200);
