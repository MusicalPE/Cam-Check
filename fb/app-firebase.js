/* 캠핑 체크 가족판 — 파이어베이스 연결
   - 구글 로그인, 가족 공간(families/{id}) 하나를 가족이 함께 씀
   - 체크는 한 칸씩, 목록·여행 정보는 통째로 저장
   - 인터넷이 끊겨도 이 기기에 두었다가 연결되면 올라감
   화면 쪽(index.html)과는 window.CAMP 로 주고받음
   Made by 음악적체육인 */
import { firebaseConfig } from "./firebase-config.js";

const V = "10.12.2";
const SDK = `https://www.gstatic.com/firebasejs/${V}/`;
const JOIN_KEY = "campfb-join";
const C = () => window.CAMP;

/* 초대 링크(?join=가족ID.초대코드)는 로그인 창을 다녀와도 잊지 않게 잠깐 적어 둠 */
(function keepJoin(){
  try{
    const q = new URLSearchParams(location.search), j = q.get("join");
    if (j){ sessionStorage.setItem(JOIN_KEY, j); history.replaceState(null, "", location.pathname); }
  }catch(e){}
})();
const pendingJoin = () => { try{ return sessionStorage.getItem(JOIN_KEY); }catch(e){ return null; } };
const clearJoin = () => { try{ sessionStorage.removeItem(JOIN_KEY); }catch(e){} };

function friendly(e){
  const code = (e && e.code) || "";
  const map = {
    "auth/unauthorized-domain": "파이어베이스 [Authentication > 설정 > 승인된 도메인]에 musicalpe.github.io 를 넣어 주세요.",
    "auth/popup-closed-by-user": "로그인 창이 닫혔어요. 다시 눌러 주세요.",
    "auth/cancelled-popup-request": "로그인 창이 닫혔어요. 다시 눌러 주세요.",
    "auth/network-request-failed": "인터넷 연결을 확인해 주세요.",
    "auth/operation-not-allowed": "파이어베이스 [Authentication > 로그인 방법]에서 Google 을 사용 설정해 주세요.",
    "permission-denied": "권한이 없어요. 초대 링크가 바뀌었거나, 파이어베이스 보안 규칙이 아직 안 들어갔을 수 있어요.",
    "unavailable": "인터넷 연결을 확인해 주세요."
  };
  return new Error(map[code] || (e && e.message) || "알 수 없는 오류");
}
const randomCode = (n = 10) => {
  const a = "abcdefghijkmnpqrstuvwxyz23456789", b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return Array.from(b, x => a[x % a.length]).join("");
};

if (!firebaseConfig || !firebaseConfig.apiKey){
  C().setAccount({phase:"noconfig"});
} else {
  start().catch(err => {
    console.error(err);
    C().setAccount({phase:"noconfig"});
    C().showConnState && C().showConnState();
  });
}

async function start(){
  const [{ initializeApp }, A, F] = await Promise.all([
    import(SDK + "firebase-app.js"), import(SDK + "firebase-auth.js"), import(SDK + "firebase-firestore.js")
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  let db;
  try{
    db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
  }catch(e){ db = F.getFirestore(app); }

  let me = null, unsubs = [], fid = null;
  const stop = () => { unsubs.forEach(u => { try{ u(); }catch(e){} }); unsubs = []; fid = null; };

  window.FBAPP = {
    async login(){
      const p = new A.GoogleAuthProvider();
      p.setCustomParameters({ prompt: "select_account" });
      try{ await A.signInWithPopup(auth, p); }
      catch(e){
        if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) return A.signInWithRedirect(auth, p);
        throw friendly(e);
      }
    },
    logout(){ return A.signOut(auth); },
    async createFamily(name, data, localRecords){
      if (!me) throw new Error("먼저 로그인해 주세요.");
      const fref = F.doc(F.collection(db, "families"));
      await F.setDoc(fref, Object.assign({}, data, {
        name, owner: me.uid, members: [me.uid],
        memberInfo: { [me.uid]: { name: me.name, email: me.email } },
        invite: randomCode(), createdAt: F.serverTimestamp()
      })).catch(e => { throw friendly(e); });
      const col = F.collection(fref, "records");
      for (const r of (localRecords || [])){
        const copy = Object.assign({}, r); delete copy.id;
        await F.addDoc(col, Object.assign(copy, { by: me.uid, createdAt: F.serverTimestamp() }));
      }
      await F.setDoc(F.doc(db, "users", me.uid), { family: fref.id }, { merge: true });
      enter(fref.id);
    }
  };

  async function join(code){
    const [id, inv] = String(code).split(".");
    if (!id || !inv) return;
    const fref = F.doc(db, "families", id);
    await F.updateDoc(fref, {
      members: F.arrayUnion(me.uid),
      [`memberInfo.${me.uid}`]: { name: me.name, email: me.email },
      joinWith: inv
    });
    await F.setDoc(F.doc(db, "users", me.uid), { family: id }, { merge: true });
  }

  function famInfo(id, d){
    return {
      id, name: d.name || "우리 가족 캠핑", invite: d.invite,
      members: (d.members || []).map(u => ({ uid: u, name: (d.memberInfo && d.memberInfo[u] && d.memberInfo[u].name) || "가족" }))
    };
  }

  function enter(id){
    stop(); fid = id;
    const fref = F.doc(db, "families", id), col = F.collection(fref, "records");
    const remote = {
      saveSettings: obj => F.updateDoc(fref, Object.assign({}, obj, { updatedBy: me.uid, updatedAt: F.serverTimestamp() })).catch(e => { throw friendly(e); }),
      check: (itemId, on) => F.updateDoc(fref, new F.FieldPath("checked", itemId), on ? true : F.deleteField()).catch(e => { throw friendly(e); }),
      clearChecks: () => F.updateDoc(fref, { checked: {} }).catch(e => { throw friendly(e); }),
      addRecord: rec => F.addDoc(col, Object.assign({}, rec, { by: me.uid, createdAt: F.serverTimestamp() })).catch(e => { throw friendly(e); }),
      deleteRecord: rid => F.deleteDoc(F.doc(col, rid)).catch(e => { throw friendly(e); })
    };
    let first = true;
    unsubs.push(F.onSnapshot(fref, { includeMetadataChanges: true }, snap => {
      if (!snap.exists()){ leave("가족 공간이 없어졌어요."); return; }
      const d = snap.data(), wasFirst = first;
      if (first){ first = false; C().enterFamily(famInfo(id, d), remote); }
      else C().updateFamilyInfo(famInfo(id, d));
      if (wasFirst || !snap.metadata.hasPendingWrites) C().applyFamily(d);   // 내가 막 바꾼 것은 화면에 이미 있음
      C().showConnState();
    }, err => {
      if (err && err.code === "permission-denied") leave("이 가족 공간에서 빠졌거나 권한이 없어요.");
      else C().showConnState();
    }));
    unsubs.push(F.onSnapshot(F.query(col, F.orderBy("date", "desc")), qs => {
      C().applyRecords(qs.docs.map(x => Object.assign({}, x.data(), { id: x.id })));
    }, () => {}));
  }

  async function leave(why){
    stop();
    C().leaveFamily();
    if (me){
      try{ await F.setDoc(F.doc(db, "users", me.uid), { family: F.deleteField() }, { merge: true }); }catch(e){}
      C().setAccount({ phase: "nofamily", user: me, why });
    }
  }

  A.getRedirectResult(auth).catch(() => {});
  A.onAuthStateChanged(auth, async user => {
    stop();
    if (!user){
      me = null;
      C().leaveFamily();
      C().setAccount({ phase: "out", joining: !!pendingJoin() });
      return;
    }
    me = { uid: user.uid, name: user.displayName || (user.email || "").split("@")[0] || "나", email: user.email || "" };
    C().setAccount({ phase: "loading", user: me });
    const code = pendingJoin();
    if (code){
      try{ await join(code); }
      catch(e){ console.warn(e); window.toast && window.toast("초대 링크로 들어가지 못했어요. 가족에게 새 QR을 받아 주세요."); }
      clearJoin();
    }
    let famId = null;
    try{
      const u = await F.getDoc(F.doc(db, "users", me.uid));
      famId = u.exists() ? u.data().family : null;
    }catch(e){ console.warn(e); }
    if (famId) enter(famId);
    else C().setAccount({ phase: "nofamily", user: me });
  });
}
