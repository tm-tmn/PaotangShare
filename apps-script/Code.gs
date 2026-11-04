/**
 * เป๋าตังค์ (หลายผู้ใช้) — Apps Script backend (v5)
 *
 * ข้อมูลของผู้ใช้ทุกคนเก็บใน Google Sheet นี้ (แท็บ "รายการ" + "ผู้ใช้") และสลิปเก็บใน Google Drive ของเจ้าของสคริปต์
 * (โฟลเดอร์ "เป๋าตังค์ - สลิป" แยกโฟลเดอร์ย่อยตามผู้ใช้)
 *
 * วิธีติดตั้ง (ไม่ต้องแก้โค้ดในไฟล์นี้):
 * 1. สร้าง Google Sheet ใหม่ → เมนู ส่วนขยาย (Extensions) → Apps Script
 * 2. ลบโค้ดเดิม แล้ววางไฟล์นี้ทั้งหมด → กดบันทึก 💾
 * 3. เลือกฟังก์ชัน setup ที่แถบด้านบน → กด Run → อนุญาตสิทธิ์
 *      (ถ้าขึ้น "Google hasn't verified this app" ให้กด Advanced → Go to ... (unsafe) → Allow — เป็นสคริปต์ของคุณเอง)
 *    ดูที่ Execution log จะเห็น "รหัสลับ (APPS_SCRIPT_SECRET)" → คัดลอกเก็บไว้
 * 4. ทำให้ใช้งานได้ (Deploy) → การทำให้ใช้งานได้รายการใหม่ → ประเภท: เว็บแอป
 *      - ดำเนินการในฐานะ: ฉัน (Me)
 *      - ผู้มีสิทธิ์เข้าถึง: ทุกคน (Anyone)
 * 5. คัดลอก URL ของเว็บแอป (ลงท้ายด้วย /exec) ไปใส่ APPS_SCRIPT_URL ใน Vercel
 *
 * ลืมรหัสลับ: เลือกฟังก์ชัน showSecret แล้วกด Run
 * อัปเดตเป็นเวอร์ชันใหม่: วางโค้ดใหม่ทับ → บันทึก → Run setup อีกครั้ง (รหัสลับเดิมยังอยู่)
 *   → Deploy → Manage deployments → ✏️ → Version: New version → Deploy (URL เดิมใช้ต่อได้)
 *
 * หมายเหตุ: สคริปต์ไม่ตรวจ PIN เอง — แอปบน Vercel (ซึ่งถือรหัสลับ) เป็นผู้ยืนยันตัวตนแล้วส่ง uid มา
 */

// รหัสลับเก็บใน Script Properties (สร้างให้อัตโนมัติตอน Run setup) — ไม่ต้องแก้บรรทัดนี้
const SECRET_OVERRIDE = '';
const VERSION = 5;

const TX_TAB = 'รายการ';
const USER_TAB = 'ผู้ใช้';
const FOLDER_NAME = 'เป๋าตังค์ - สลิป';
const TX_HEADERS = ['id', 'createdAt', 'date', 'type', 'amount', 'category', 'note', 'bank', 'transRef', 'slipFileId', 'account', 'userId'];
const NCOL = TX_HEADERS.length;
const UID_COL = 11; // 0-based index of userId in a transaction row
const USER_HEADERS = ['id', 'email', 'name', 'status', 'role', 'createdAt', 'lastLogin', 'pinEnc', 'folderId', 'geminiKey', 'settings'];
const UCOL = USER_HEADERS.length;
const MAX_PENDING = 100;
const TZ = 'Asia/Bangkok';

const DEFAULT_SETTINGS = {
  expenseCategories: ['อาหาร', 'เดินทาง', 'ช้อปปิ้ง', 'บิล/ค่าน้ำไฟ', 'ที่พัก', 'สุขภาพ', 'บันเทิง', 'โอนให้คนอื่น', 'อื่น ๆ'],
  incomeCategories: ['เงินเดือน', 'โบนัส', 'ขายของ', 'รับโอน', 'ดอกเบี้ย/ปันผล', 'อื่น ๆ'],
  accounts: ['เงินสด'],
  budgets: {},
  recurring: [],
  weeklyEmail: false,
  monthlyLimit: 0,
};

function secret_() {
  return SECRET_OVERRIDE || PropertiesService.getScriptProperties().getProperty('SECRET') || '';
}

// ---------- one-time setup ----------

// กด Run ฟังก์ชันนี้หนึ่งครั้งในหน้า Apps Script: อนุญาตสิทธิ์ทั้งหมด + สร้างรหัสลับ + ตั้งเวลางานอัตโนมัติ
function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!SECRET_OVERRIDE && !props.getProperty('SECRET')) {
    props.setProperty('SECRET', (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''));
  }
  authorize();
  ensureTriggers_();
  showSecret();
}

// แสดงรหัสลับอีกครั้ง (ใส่เป็น APPS_SCRIPT_SECRET ใน Vercel)
function showSecret() {
  Logger.log('รหัสลับ (APPS_SCRIPT_SECRET) ของคุณคือ: ' + secret_());
  Logger.log('อย่าส่งรหัสนี้ให้ใคร — ใครมีรหัสนี้กับ URL เว็บแอป จะอ่านข้อมูลของผู้ใช้ทุกคนได้');
}

function authorize() {
  txSheet_();
  userSheet_();
  folder_();
  ScriptApp.getProjectTriggers();
  MailApp.getRemainingDailyQuota();
  Session.getEffectiveUser().getEmail();
  UrlFetchApp.fetch('https://www.google.com/generate_204', { muteHttpExceptions: true });
  Logger.log('OK — อนุญาตสิทธิ์เรียบร้อย');
}

// weekly summary (Sun 19:00) + daily recurring items (06:00) for every user — installed once
function ensureTriggers_() {
  const names = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  if (names.indexOf('weeklySummary') < 0) {
    ScriptApp.newTrigger('weeklySummary').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(19).inTimezone(TZ).create();
  }
  if (names.indexOf('dailyJob') < 0) {
    ScriptApp.newTrigger('dailyJob').timeBased().everyDays(1).atHour(6).inTimezone(TZ).create();
  }
}

// ---------- web app ----------

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ error: 'bad request' });
  }
  const sec = secret_();
  if (!req || !sec || req.secret !== sec) {
    return json_({ error: 'unauthorized' });
  }
  try {
    return json_(route_(req));
  } catch (err) {
    return json_({ error: String(err && err.message ? err.message : err) });
  }
}

function doGet() {
  return json_({ ok: true, app: 'เป๋าตังค์', version: VERSION });
}

function route_(req) {
  switch (req.action) {
    case 'ping':
      return {
        ok: true, version: VERSION, multiUser: true,
        sheet: SpreadsheetApp.getActiveSpreadsheet().getUrl(), folder: folder_().getUrl(),
        users: users_().length, mailQuota: MailApp.getRemainingDailyQuota(),
      };

    // ----- accounts (called by the app server only) -----
    case 'userFind': {
      const u = findUser_('email', normEmail_(req.email));
      return { user: u ? privateUser_(u) : null };
    }
    case 'userGet': {
      const u = findUser_('id', req.id);
      return { user: u ? privateUser_(u) : null };
    }
    case 'userCreate':
      return { user: createUser_(req.user) };
    case 'userUpdate':
      return { user: updateUser_(req.id, req.patch) };
    case 'userList':
      return { users: listUsers_() };
    case 'userDelete':
      return deleteUser_(req.id);
    case 'auth':
      return auth_(String(req.key || ''), req.op);

    // ----- one user's data -----
    case 'bootstrap': {
      const u = activeUser_(req.uid);
      runRecurring_(u);
      return { items: list_(u.id), settings: settingsOf_(u), user: publicUser_(u) };
    }
    case 'add':
      return add_(activeUser_(req.uid), req.tx, req.slip);
    case 'update':
      return update_(activeUser_(req.uid), req.id, req.patch, req.slip);
    case 'delete':
      return delete_(activeUser_(req.uid), req.id);
    case 'slip':
      return slip_(activeUser_(req.uid), req.id);
    case 'getSettings':
      return { settings: settingsOf_(activeUser_(req.uid)) };
    case 'saveSettings': {
      const u = activeUser_(req.uid);
      rememberAppUrl_(req.appUrl);
      ensureTriggers_();
      return { settings: saveSettings_(u, req.settings) };
    }
    case 'testEmail': {
      const u = activeUser_(req.uid);
      rememberAppUrl_(req.appUrl);
      return { ok: true, to: u.email, pdf: sendSummary_(u) };
    }
    default:
      return { error: 'unknown action' };
  }
}

// ---------- helpers ----------

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function ensureTab_(name, headers, index) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name, index);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  } else if (sh.getRange(1, headers.length).getValue() !== headers[headers.length - 1]) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  }
  return sh;
}

function txSheet_() { return ensureTab_(TX_TAB, TX_HEADERS, 0); }
function userSheet_() { return ensureTab_(USER_TAB, USER_HEADERS, 1); }

function folder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('FOLDER_ID');
  if (id) {
    try {
      const f = DriveApp.getFolderById(id);
      if (!f.isTrashed()) return f;
    } catch (err) {}
  }
  const f = DriveApp.createFolder(FOLDER_NAME);
  props.setProperty('FOLDER_ID', f.getId());
  return f;
}

function today_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function normEmail_(e) {
  return String(e || '').trim().toLowerCase();
}

// ---------- users ----------

function users_() {
  const sh = userSheet_();
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, UCOL).getDisplayValues().map(function (r, i) {
    const u = { row: i + 2 };
    USER_HEADERS.forEach(function (h, j) { u[h] = String(r[j] || ''); });
    return u;
  }).filter(function (u) { return u.id; });
}

function findUser_(key, val) {
  if (!val) return null;
  return users_().filter(function (u) { return u[key] === val; })[0] || null;
}

function writeUser_(u) {
  const sh = userSheet_();
  sh.getRange(u.row, 1, 1, UCOL).setNumberFormat('@');
  sh.getRange(u.row, 1, 1, UCOL).setValues([USER_HEADERS.map(function (h) { return u[h] || ''; })]);
}

function publicUser_(u) {
  return {
    id: u.id, email: u.email, name: u.name, status: u.status, role: u.role,
    createdAt: u.createdAt, lastLogin: u.lastLogin, hasGeminiKey: !!u.geminiKey,
  };
}

// for the app server: includes the encrypted PIN and the user's Gemini key
function privateUser_(u) {
  const p = publicUser_(u);
  p.pinEnc = u.pinEnc;
  p.geminiKey = u.geminiKey;
  return p;
}

function activeUser_(uid) {
  const u = findUser_('id', String(uid || ''));
  if (!u || u.status !== 'active') throw new Error('user_inactive');
  return u;
}

function createUser_(input) {
  return withLock_(function () {
    const email = normEmail_(input && input.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('อีเมลไม่ถูกต้อง');
    const all = users_();
    if (all.some(function (u) { return u.email === email; })) throw new Error('อีเมลนี้สมัครไว้แล้ว');
    const status = input.status === 'active' ? 'active' : 'pending';
    if (status === 'pending' && all.filter(function (u) { return u.status === 'pending'; }).length >= MAX_PENDING) {
      throw new Error('มีผู้สมัครรออนุมัติจำนวนมาก ลองใหม่ภายหลัง');
    }
    const u = {
      row: userSheet_().getLastRow() + 1,
      id: Utilities.getUuid(),
      email: email,
      name: String(input.name || '').slice(0, 60),
      status: status,
      role: input.role === 'admin' ? 'admin' : 'user',
      createdAt: new Date().toISOString(),
      lastLogin: '',
      pinEnc: String(input.pinEnc || ''),
      folderId: '',
      geminiKey: '',
      settings: '',
    };
    writeUser_(u);
    return publicUser_(u);
  });
}

function updateUser_(id, patch) {
  return withLock_(function () {
    const u = findUser_('id', String(id || ''));
    if (!u) throw new Error('ไม่พบผู้ใช้');
    ['name', 'status', 'role', 'pinEnc', 'geminiKey', 'lastLogin'].forEach(function (k) {
      if (patch && patch[k] !== undefined) u[k] = String(patch[k]).slice(0, k === 'pinEnc' ? 400 : 200);
    });
    if (['pending', 'active', 'suspended'].indexOf(u.status) < 0) u.status = 'pending';
    if (u.role !== 'admin') u.role = 'user';
    writeUser_(u);
    return publicUser_(u);
  });
}

function listUsers_() {
  const counts = {};
  txRows_().forEach(function (r) { counts[r[UID_COL]] = (counts[r[UID_COL]] || 0) + 1; });
  return users_().map(function (u) {
    const p = publicUser_(u);
    p.txCount = counts[u.id] || 0;
    return p;
  });
}

// removes the account, all of its rows and its slip folder (Drive trash keeps files for 30 days)
function deleteUser_(id) {
  return withLock_(function () {
    const u = findUser_('id', String(id || ''));
    if (!u) throw new Error('ไม่พบผู้ใช้');
    const sh = txSheet_();
    const n = sh.getLastRow() - 1;
    let removed = 0;
    if (n > 0) {
      const values = sh.getRange(2, 1, n, NCOL).getValues();
      const keep = values.filter(function (r) { return String(r[UID_COL]) !== u.id; });
      removed = values.length - keep.length;
      if (removed) {
        sh.getRange(2, 1, n, NCOL).clearContent();
        if (keep.length) sh.getRange(2, 1, keep.length, NCOL).setValues(keep);
      }
    }
    if (u.folderId) {
      try { DriveApp.getFolderById(u.folderId).setTrashed(true); } catch (err) {}
    }
    userSheet_().deleteRow(u.row);
    const props = PropertiesService.getScriptProperties();
    props.deleteProperty('RDONE_' + u.id);
    props.deleteProperty('AUTH_' + u.email);
    return { ok: true, removed: removed };
  });
}

function userFolder_(u) {
  if (u.folderId) {
    try {
      const f = DriveApp.getFolderById(u.folderId);
      if (!f.isTrashed()) return f;
    } catch (err) {}
  }
  const f = folder_().createFolder(u.email || u.id);
  u.folderId = f.getId();
  writeUser_(u);
  return f;
}

// ---------- transactions ----------

function rowToTx_(r) {
  return {
    id: String(r[0]),
    createdAt: String(r[1]),
    date: String(r[2]),
    type: r[3] === 'income' ? 'income' : 'expense',
    amount: Number(String(r[4]).replace(/,/g, '')) || 0,
    category: String(r[5] || ''),
    note: String(r[6] || ''),
    bank: String(r[7] || ''),
    transRef: String(r[8] || ''),
    slipFileId: String(r[9] || ''),
    account: String(r[10] || ''),
  };
}

function txToRow_(tx, uid) {
  return [
    tx.id, tx.createdAt, tx.date, tx.type, Number(tx.amount),
    tx.category || '', tx.note || '', tx.bank || '', tx.transRef || '', tx.slipFileId || '', tx.account || '', uid,
  ];
}

function txRows_() {
  const sh = txSheet_();
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, NCOL).getDisplayValues();
}

function writeRow_(rowNum, tx, uid) {
  const sh = txSheet_();
  // text columns stay text (no auto date conversion); amount stays a number for SUM()
  sh.getRange(rowNum, 1, 1, 4).setNumberFormat('@');
  sh.getRange(rowNum, 6, 1, NCOL - 5).setNumberFormat('@');
  sh.getRange(rowNum, 5).setNumberFormat('#,##0.00');
  sh.getRange(rowNum, 1, 1, NCOL).setValues([txToRow_(tx, uid)]);
}

function saveSlip_(u, slip) {
  if (!slip || !slip.data) return '';
  const blob = Utilities.newBlob(Utilities.base64Decode(slip.data), slip.mime || 'image/jpeg', slip.name || 'slip.jpg');
  return userFolder_(u).createFile(blob).getId();
}

function list_(uid) {
  return txRows_().filter(function (r) { return r[0] && r[UID_COL] === uid; }).map(rowToTx_);
}

function add_(u, tx, slip) {
  return withLock_(function () {
    if (tx.transRef) {
      const dup = txRows_().filter(function (r) { return r[UID_COL] === u.id && r[8] === tx.transRef; })[0];
      if (dup) {
        const d = rowToTx_(dup);
        return { error: 'สลิปนี้บันทึกไปแล้ว (' + d.date + ', ' + d.amount + ' บาท)', duplicate: true };
      }
    }
    tx.slipFileId = saveSlip_(u, slip) || '';
    writeRow_(txSheet_().getLastRow() + 1, tx, u.id);
    return { item: tx };
  });
}

function update_(u, id, patch, slip) {
  return withLock_(function () {
    const rows = txRows_();
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] !== id || rows[i][UID_COL] !== u.id) continue;
      const tx = rowToTx_(rows[i]);
      ['date', 'type', 'amount', 'category', 'note', 'bank', 'transRef', 'account'].forEach(function (k) {
        if (patch && patch[k] !== undefined) tx[k] = patch[k];
      });
      if (tx.transRef) {
        const dup = rows.filter(function (r, j) { return j !== i && r[UID_COL] === u.id && r[8] === tx.transRef; })[0];
        if (dup) return { error: 'เลขอ้างอิงนี้ซ้ำกับรายการอื่น', duplicate: true };
      }
      if (slip && slip.data) {
        if (tx.slipFileId) {
          try { DriveApp.getFileById(tx.slipFileId).setTrashed(true); } catch (err) {}
        }
        tx.slipFileId = saveSlip_(u, slip);
      }
      writeRow_(i + 2, tx, u.id);
      return { item: tx };
    }
    return { error: 'ไม่พบรายการ' };
  });
}

function delete_(u, id) {
  return withLock_(function () {
    const rows = txRows_();
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === id && rows[i][UID_COL] === u.id) {
        const fileId = rows[i][9];
        txSheet_().deleteRow(i + 2);
        if (fileId) {
          try { DriveApp.getFileById(fileId).setTrashed(true); } catch (err) {}
        }
        return { ok: true };
      }
    }
    return { error: 'ไม่พบรายการ' };
  });
}

// only files that belong to one of this user's own rows, inside their own folder
function slip_(u, fileId) {
  const owns = txRows_().some(function (r) { return r[UID_COL] === u.id && r[9] === fileId; });
  if (!owns || !u.folderId) return { error: 'not found' };
  const file = DriveApp.getFileById(fileId);
  const parents = file.getParents();
  let ok = false;
  while (parents.hasNext()) if (parents.next().getId() === u.folderId) ok = true;
  if (!ok) return { error: 'not found' };
  const blob = file.getBlob();
  return { mime: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) };
}

// ---------- PIN lockout (per account) ----------
// Wrong PIN 5 times -> locked 15 min; each further lock doubles (max 24 h). A correct PIN resets it.
const AUTH_MAX_FAILS = 5;
const AUTH_BASE_LOCK_MS = 15 * 60 * 1000;
const AUTH_MAX_LOCK_MS = 24 * 60 * 60 * 1000;

function auth_(key, op) {
  key = normEmail_(key).slice(0, 120) || '-';
  return withLock_(function () {
    const props = PropertiesService.getScriptProperties();
    const name = 'AUTH_' + key;
    let st = { fails: 0, level: 0, lockUntil: 0 };
    try { st = Object.assign(st, JSON.parse(props.getProperty(name) || '{}')); } catch (err) {}
    const now = Date.now();
    const locked = st.lockUntil > now;
    if (op === 'fail' && !locked) {
      st.fails += 1;
      if (st.fails >= AUTH_MAX_FAILS) {
        st.level += 1;
        st.lockUntil = now + Math.min(AUTH_BASE_LOCK_MS * Math.pow(2, st.level - 1), AUTH_MAX_LOCK_MS);
        st.fails = 0;
      }
      props.setProperty(name, JSON.stringify(st));
    } else if (op === 'ok') {
      props.deleteProperty(name);
      st = { fails: 0, level: 0, lockUntil: 0 };
    }
    const isLocked = st.lockUntil > now;
    return {
      locked: isLocked,
      lockUntil: isLocked ? st.lockUntil : 0,
      remaining: isLocked ? 0 : AUTH_MAX_FAILS - st.fails,
    };
  });
}

// ---------- settings (per user) ----------

function settingsOf_(u) {
  let s = {};
  try { s = u.settings ? JSON.parse(u.settings) : {}; } catch (err) {}
  const out = {};
  Object.keys(DEFAULT_SETTINGS).forEach(function (k) { out[k] = DEFAULT_SETTINGS[k]; });
  Object.keys(s).forEach(function (k) { out[k] = s[k]; });
  return out;
}

function saveSettings_(u, s) {
  // the app validates settings before sending; keep every key so new settings work without a script update
  const clean = settingsOf_(u);
  Object.keys(s || {}).forEach(function (k) { clean[k] = s[k]; });
  const raw = JSON.stringify(clean);
  if (raw.length > 40000) throw new Error('ตั้งค่ามากเกินไป ลองลดจำนวนหมวดหรือรายการประจำ');
  withLock_(function () {
    const fresh = findUser_('id', u.id);
    fresh.settings = raw;
    writeUser_(fresh);
  });
  return clean;
}

// ---------- recurring (per user) ----------

function dailyJob() {
  users_().filter(function (u) { return u.status === 'active'; }).forEach(function (u) {
    try { runRecurring_(u); } catch (err) { Logger.log('recurring ' + u.email + ': ' + err); }
  });
}

function runRecurring_(u) {
  const s = settingsOf_(u);
  if (!s.recurring || !s.recurring.length) return;
  const props = PropertiesService.getScriptProperties();
  const key = 'RDONE_' + u.id;
  let done = {};
  try { done = JSON.parse(props.getProperty(key) || '{}'); } catch (err) {}
  const today = today_();
  const ym = today.slice(0, 7);
  const dayNow = Number(today.slice(8, 10));
  let changed = false;

  withLock_(function () {
    s.recurring.forEach(function (r) {
      if (!r || !r.id || !(Number(r.amount) > 0)) return;
      const day = Math.min(Math.max(Number(r.day) || 1, 1), 28);
      if (dayNow < day || done[r.id] === ym) return;
      const tx = {
        id: Utilities.getUuid(),
        createdAt: new Date().toISOString(),
        date: ym + '-' + ('0' + day).slice(-2),
        type: r.type === 'income' ? 'income' : 'expense',
        amount: Number(r.amount),
        category: r.category || '',
        note: (r.note || '') + ' (ประจำ)',
        bank: '',
        transRef: '',
        slipFileId: '',
        account: r.account || '',
      };
      writeRow_(txSheet_().getLastRow() + 1, tx, u.id);
      done[r.id] = ym;
      changed = true;
    });
  });
  if (changed) props.setProperty(key, JSON.stringify(done));
}

// ---------- weekly email (per user) ----------

function fmt_(n) {
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function esc_(s) {
  return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
}

// time trigger: every active user who turned the weekly email on
function weeklySummary() {
  users_().forEach(function (u) {
    if (u.status !== 'active' || !settingsOf_(u).weeklyEmail) return;
    try { sendSummary_(u); } catch (err) { Logger.log('summary ' + u.email + ': ' + err); }
  });
}

function sendSummary_(u) {
  runRecurring_(u);
  const s = settingsOf_(u);
  const items = list_(u.id);
  const now = new Date();
  const to = today_();
  const from = Utilities.formatDate(new Date(now.getTime() - 6 * 86400000), TZ, 'yyyy-MM-dd');
  const ym = to.slice(0, 7);

  const week = items.filter(function (t) { return t.date >= from && t.date <= to; });
  const month = items.filter(function (t) { return t.date.slice(0, 7) === ym; });
  const sum = function (arr, type) {
    return arr.filter(function (t) { return t.type === type; }).reduce(function (a, t) { return a + t.amount; }, 0);
  };

  const byCat = {};
  week.filter(function (t) { return t.type === 'expense'; }).forEach(function (t) {
    byCat[t.category || 'อื่น ๆ'] = (byCat[t.category || 'อื่น ๆ'] || 0) + t.amount;
  });
  const catRows = Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; }).map(function (c) {
    return '<tr><td>' + esc_(c) + '</td><td style="text-align:right">' + fmt_(byCat[c]) + '</td></tr>';
  }).join('');

  const monthCat = {};
  month.filter(function (t) { return t.type === 'expense'; }).forEach(function (t) {
    monthCat[t.category] = (monthCat[t.category] || 0) + t.amount;
  });
  const budgetRows = Object.keys(s.budgets || {}).filter(function (c) { return s.budgets[c] > 0; }).map(function (c) {
    const used = monthCat[c] || 0;
    const pct = Math.round((used / s.budgets[c]) * 100);
    const color = pct >= 100 ? '#b4452f' : pct >= 80 ? '#c98a12' : '#0f7a52';
    return '<tr><td>' + esc_(c) + '</td><td style="text-align:right;color:' + color + '">' + fmt_(used) + ' / ' + fmt_(s.budgets[c]) + ' (' + pct + '%)</td></tr>';
  }).join('');

  const pdf = fetchReportPdf_(u, from, to);
  const html =
    '<div style="font-family:sans-serif;max-width:480px">' +
    '<h2 style="color:#e0508e">เป๋าตังค์ — สรุปสัปดาห์</h2>' +
    (u.name ? '<p>สวัสดีคุณ ' + esc_(u.name) + '</p>' : '') +
    '<p>' + from + ' ถึง ' + to + '</p>' +
    '<p>รายรับ <b style="color:#0f7a52">' + fmt_(sum(week, 'income')) + '</b> บาท · ' +
    'รายจ่าย <b style="color:#b4452f">' + fmt_(sum(week, 'expense')) + '</b> บาท</p>' +
    (catRows ? '<h3>รายจ่ายตามหมวด (7 วัน)</h3><table width="100%">' + catRows + '</table>' : '<p>สัปดาห์นี้ไม่มีรายจ่าย</p>') +
    '<h3>เดือนนี้</h3><p>รับ ' + fmt_(sum(month, 'income')) + ' · จ่าย ' + fmt_(sum(month, 'expense')) +
    ' · คงเหลือ ' + fmt_(sum(month, 'income') - sum(month, 'expense')) + ' บาท</p>' +
    (s.monthlyLimit > 0 ? (function () {
      const used = sum(month, 'expense');
      const pct = Math.round((used / s.monthlyLimit) * 100);
      const color = pct >= 100 ? '#b4452f' : pct >= 80 ? '#c98a12' : '#0f7a52';
      return '<p>วงเงินเดือนนี้: <b style="color:' + color + '">' + fmt_(used) + ' / ' + fmt_(s.monthlyLimit) + ' บาท (' + pct + '%)</b></p>';
    })() : '') +
    (budgetRows ? '<h3>งบประมาณเดือนนี้</h3><table width="100%">' + budgetRows + '</table>' : '') +
    (pdf
      ? '<p style="color:#9a7d94;font-size:13px">📎 แนบ PDF สรุปรายการทั้งหมดมาด้วย — รหัสผ่านเปิดไฟล์คือ PIN ที่คุณใช้เข้าแอป</p>'
      : '<p style="color:#9a7d94;font-size:13px">ดู/ดาวน์โหลด PDF ได้ที่แอป → ตั้งค่า → สรุป PDF</p>') +
    '<p style="color:#9a7d94;font-size:12px">ไม่อยากรับอีเมลนี้: ในแอป → ตั้งค่า → เอาติ๊ก "ส่งสรุปรายสัปดาห์" ออก</p>' +
    '</div>';

  const mail = {
    to: u.email,
    subject: 'เป๋าตังค์ · สรุปสัปดาห์ ' + from + ' – ' + to,
    htmlBody: html,
  };
  if (pdf) mail.attachments = [pdf];
  MailApp.sendEmail(mail);
  return !!pdf;
}

// the app's public address is remembered whenever settings are saved from the app
function rememberAppUrl_(url) {
  if (typeof url === 'string' && /^https?:\/\/[A-Za-z0-9.:-]+$/.test(url)) {
    PropertiesService.getScriptProperties().setProperty('APP_URL', url);
  }
}

// asks the app for this user's (password-protected) PDF; returns a blob or null — the email still goes out without it
function fetchReportPdf_(u, from, to) {
  const base = PropertiesService.getScriptProperties().getProperty('APP_URL');
  if (!base) return null;
  try {
    const res = UrlFetchApp.fetch(base + '/api/report?from=' + from + '&to=' + to + '&uid=' + encodeURIComponent(u.id), {
      headers: { 'x-report-secret': secret_() },
      muteHttpExceptions: true,
    });
    const type = String(res.getHeaders()['Content-Type'] || res.getHeaders()['content-type'] || '');
    if (res.getResponseCode() !== 200 || type.indexOf('application/pdf') < 0) return null;
    return res.getBlob().setName('paotang-' + from + '_' + to + '.pdf');
  } catch (err) {
    return null;
  }
}
