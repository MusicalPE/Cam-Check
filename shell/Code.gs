/**
 * 캠핑 준비물 체크리스트 — 구글 시트 껍데기
 * 화면은 GitHub Pages에 있고, 이 스크립트는 시트에 자료를 읽고 쓰는 일만 합니다.
 * Made by 음악적체육인
 *
 * ▼ 아래 비밀 코드를 원하는 말로 바꾼 뒤 배포하세요.
 *   (화면에서 처음 연결할 때 이 코드를 넣어야 시트에 읽고 쓸 수 있어요)
 */
const SECRET = '여기에-비밀코드-입력';

const SHEET_RECORD = '캠핑기록';
const SHEET_SETTING = '설정';
const HEADER = ['출발일', '박', '캠핑장', '최저기온', '메모', '챙긴 수', '전체 수', '챙긴 항목', '안 챙긴 항목', '저장 시각', '기록ID', '우리 별점', '주소', '장소 링크', '장소ID'];

const APP_URL = 'https://musicalpe.github.io/CampCheck/';

/** 웹 앱 주소(/exec)를 열면 GitHub 화면으로 넘어가면서 이 시트와 자동으로 연결 */
function doGet() {
  const url = APP_URL + '?api=' + encodeURIComponent(ScriptApp.getService().getUrl()) +
    '&key=' + encodeURIComponent(SECRET);
  const safe = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const html =
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{font-family:sans-serif;background:#ECEEE8;color:#1C201C;display:grid;place-items:center;min-height:90vh;margin:0;text-align:center}' +
    'a{display:inline-block;margin-top:14px;background:#2F4A36;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600}</style>' +
    '</head><body><div><div>캠핑 체크리스트를 여는 중…</div>' +
    '<a href="' + safe + '" target="_top">바로 열기</a></div>' +
    '<script>try{window.top.location.href=' + JSON.stringify(url) + ';}catch(e){}</script>' +
    '</body></html>';
  return HtmlService.createHtmlOutput(html)
    .setTitle('캠핑 준비물 체크리스트')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: '요청을 읽지 못했어요.' });
  }
  if (String(req.key || '') !== SECRET) return json_({ ok: false, error: '비밀 코드가 맞지 않아요.' });

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    switch (req.action) {
      case 'get':
        return json_({ ok: true, settings: readSettings_(), records: getRecords_() });
      case 'saveSettings':
        return json_(saveSettings_(req.settings, req.withChecked));
      case 'check':
        return json_(check_(req.id, req.on));
      case 'clearChecks':
        return json_(clearChecks_());
      case 'saveRecord':
        return json_({ ok: true, records: saveRecord_(req.rec || {}) });
      case 'deleteRecord':
        return json_({ ok: true, records: deleteRecord_(req.id) });
      case 'updateRecord':
        return json_({ ok: true, records: updateRecord_(req.id, req.rating) });
      default:
        return json_({ ok: false, error: '모르는 요청이에요.' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_(name, header) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (sh && header && sh.getLastColumn() < header.length) {   // 예전 시트에 새 칸(별점 등) 제목 붙이기
    sh.getRange(1, 1, 1, header.length).setValues([header])
      .setFontWeight('bold').setBackground('#2F4A36').setFontColor('#ffffff');
  }
  if (!sh) {
    sh = ss.insertSheet(name);
    if (header) {
      sh.appendRow(header);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, header.length)
        .setFontWeight('bold').setBackground('#2F4A36').setFontColor('#ffffff');
      sh.setColumnWidth(3, 180);
      sh.setColumnWidth(5, 260);
      sh.setColumnWidth(8, 320);
      sh.setColumnWidth(9, 260);
    }
  }
  return sh;
}

/* ---------- 목록·체크 상태 (설정 탭 A1) ---------- */
function settingCell_() {
  const cell = sheet_(SHEET_SETTING).getRange('A1');
  cell.setNumberFormat('@');
  return cell;
}
function readObj_() {
  const raw = settingCell_().getValue();
  try { return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; }
}
function writeObj_(obj) {
  settingCell_().setValue(JSON.stringify(obj));
}
function readSettings_() {
  const raw = settingCell_().getValue();
  return raw ? String(raw) : '';
}

/** 목록·여행 정보 저장. 체크는 따로 합쳐서 관리(두 사람이 동시에 체크해도 안 지워지게) */
function saveSettings_(json, withChecked) {
  const incoming = JSON.parse(json);
  const old = readObj_();
  if (!withChecked || old.zones) incoming.checked = old.checked || {};
  writeObj_(incoming);
  return { ok: true };
}
function check_(id, on) {
  const obj = readObj_();
  obj.checked = obj.checked || {};
  if (on) obj.checked[id] = 1; else delete obj.checked[id];
  writeObj_(obj);
  return { ok: true };
}
function clearChecks_() {
  const obj = readObj_();
  obj.checked = {};
  writeObj_(obj);
  return { ok: true };
}

/* ---------- 캠핑 기록 ---------- */
function fmt_(v, pattern) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), pattern);
  return v === null || v === undefined ? '' : String(v);
}
function split_(v) {
  const s = String(v || '').trim();
  return s ? s.split(', ') : [];
}
function getRecords_() {
  const sh = sheet_(SHEET_RECORD, HEADER);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, HEADER.length).getValues()
    .filter(r => r[10] !== '')
    .map(r => ({
      date: fmt_(r[0], 'yyyy-MM-dd'),
      nights: fmt_(r[1]),
      place: fmt_(r[2]),
      temp: fmt_(r[3]),
      memo: fmt_(r[4]),
      got: Number(r[5]) || 0,
      total: Number(r[6]) || 0,
      packed: split_(r[7]),
      missed: split_(r[8]),
      saved: fmt_(r[9], 'yyyy-MM-dd HH:mm'),
      id: String(r[10]),
      rating: Number(r[11]) || '',
      addr: fmt_(r[12]),
      placeUrl: fmt_(r[13]),
      placeId: fmt_(r[14])
    }))
    .sort((a, b) => (b.date + b.saved).localeCompare(a.date + a.saved));
}
function saveRecord_(r) {
  const sh = sheet_(SHEET_RECORD, HEADER);
  let date = '';
  if (r.date) {
    const p = String(r.date).split('-').map(Number);
    date = new Date(p[0], p[1] - 1, p[2]);
  }
  sh.appendRow([
    date, Number(r.nights) || '', r.place || '', r.temp || '', r.memo || '',
    r.got || 0, r.total || 0, (r.packed || []).join(', '), (r.missed || []).join(', '),
    new Date(), Utilities.getUuid().slice(0, 8),
    Number(r.rating) || '', r.addr || '', r.placeUrl || '', r.placeId || ''
  ]);
  const row = sh.getLastRow();
  sh.getRange(row, 1).setNumberFormat('yyyy-mm-dd');
  sh.getRange(row, 10).setNumberFormat('yyyy-mm-dd hh:mm');
  return getRecords_();
}
function updateRecord_(id, rating) {
  const sh = sheet_(SHEET_RECORD, HEADER);
  const last = sh.getLastRow();
  if (last >= 2) {
    const ids = sh.getRange(2, 11, last - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(id)) { sh.getRange(i + 2, 12).setValue(Number(rating) || ''); break; }
    }
  }
  return getRecords_();
}
function deleteRecord_(id) {
  const sh = sheet_(SHEET_RECORD, HEADER);
  const last = sh.getLastRow();
  if (last >= 2) {
    const ids = sh.getRange(2, 11, last - 1, 1).getValues();
    for (let i = ids.length - 1; i >= 0; i--) {
      if (String(ids[i][0]) === String(id)) { sh.deleteRow(i + 2); break; }
    }
  }
  return getRecords_();
}
