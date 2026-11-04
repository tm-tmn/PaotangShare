/**
 * เป๋าตังค์ — Apps Script backend (v4)
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
 */

// รหัสลับเก็บใน Script Properties (สร้างให้อัตโนมัติตอน Run setup) — ไม่ต้องแก้บรรทัดนี้
// ถ้าอยากกำหนดเอง ใส่ข้อความสุ่มยาว ๆ ในเครื่องหมาย '' ได้
const SECRET_OVERRIDE = '';

function secret_() {
  return SECRET_OVERRIDE || PropertiesService.getScriptProperties().getProperty('SECRET') || '';
}

const TAB = 'รายการ';
const FOLDER_NAME = 'เป๋าตังค์ - สลิป';
const HEADERS = ['id', 'createdAt', 'date', 'type', 'amount', 'category', 'note', 'bank', 'transRef', 'slipFileId', 'account'];
const NCOL = HEADERS.length;
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

// กด Run ฟังก์ชันนี้หนึ่งครั้งในหน้า Apps Script: อนุญาตสิทธิ์ทั้งหมด + สร้างรหัสลับ
function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!SECRET_OVERRIDE && !props.getProperty('SECRET')) {
    props.setProperty('SECRET', (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''));
  }
  authorize();
  showSecret();
}

// แสดงรหัสลับอีกครั้ง (ใส่เป็น APPS_SCRIPT_SECRET ใน Vercel)
function showSecret() {
  Logger.log('รหัสลับ (APPS_SCRIPT_SECRET) ของคุณคือ: ' + secret_());
  Logger.log('อย่าส่งรหัสนี้ให้ใคร — ใครมีรหัสนี้กับ URL เว็บแอป จะอ่านข้อมูลของคุณได้');
}

function authorize() {
  sheet_();
  folder_();
  ScriptApp.getProjectTriggers();
  MailApp.getRemainingDailyQuota();
  Session.getEffectiveUser().getEmail();
  UrlFetchApp.fetch('https://www.google.com/generate_204', { muteHttpExceptions: true });
  Logger.log('OK — อนุญาตสิทธิ์เรียบร้อย');
}

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
    switch (req.action) {
      case 'ping':
        return json_({ ok: true, version: 4, sheet: SpreadsheetApp.getActiveSpreadsheet().getUrl(), folder: folder_().getUrl() });
      case 'bootstrap':
        runRecurring_();
        return json_({ items: list_(), settings: getSettings_() });
      case 'list':
        return json_({ items: list_() });
      case 'add':
        return json_(add_(req.tx, req.slip));
      case 'update':
        return json_(update_(req.id, req.patch, req.slip));
      case 'delete':
        return json_(delete_(req.id));
      case 'slip':
        return json_(slip_(req.id));
      case 'getSettings':
        return json_({ settings: getSettings_() });
      case 'saveSettings':
        rememberAppUrl_(req.appUrl);
        return json_({ settings: saveSettings_(req.settings) });
      case 'auth':
        return json_(auth_(req.op));
      case 'testEmail':
        rememberAppUrl_(req.appUrl);
        return json_({ ok: true, to: Session.getEffectiveUser().getEmail(), pdf: weeklySummary() });
      default:
        return json_({ error: 'unknown action' });
    }
  } catch (err) {
    return json_({ error: String(err && err.message ? err.message : err) });
  }
}

function doGet() {
  return json_({ ok: true, app: 'เป๋าตังค์', version: 4 });
}

// ---------- helpers ----------

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(TAB);
  if (!sh) {
    sh = ss.insertSheet(TAB, 0);
    sh.getRange(1, 1, 1, NCOL).setValues([HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  } else if (sh.getRange(1, NCOL).getValue() !== HEADERS[NCOL - 1]) {
    // migrate v1 sheet: add new header columns
    sh.getRange(1, 1, 1, NCOL).setValues([HEADERS]).setFontWeight('bold');
  }
  return sh;
}

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

function txToRow_(tx) {
  return [
    tx.id, tx.createdAt, tx.date, tx.type, Number(tx.amount),
    tx.category || '', tx.note || '', tx.bank || '', tx.transRef || '', tx.slipFileId || '', tx.account || '',
  ];
}

function rows_() {
  const sh = sheet_();
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, NCOL).getDisplayValues();
}

function writeRow_(rowNum, tx) {
  const sh = sheet_();
  // text columns stay text (no auto date conversion); amount stays a number for SUM()
  sh.getRange(rowNum, 1, 1, 4).setNumberFormat('@');
  sh.getRange(rowNum, 6, 1, NCOL - 5).setNumberFormat('@');
  sh.getRange(rowNum, 5).setNumberFormat('#,##0.00');
  sh.getRange(rowNum, 1, 1, NCOL).setValues([txToRow_(tx)]);
}

function saveSlip_(slip) {
  if (!slip || !slip.data) return '';
  const blob = Utilities.newBlob(Utilities.base64Decode(slip.data), slip.mime || 'image/jpeg', slip.name || 'slip.jpg');
  return folder_().createFile(blob).getId();
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

// ---------- transactions ----------

function list_() {
  return rows_().filter(function (r) { return r[0]; }).map(rowToTx_);
}

function add_(tx, slip) {
  return withLock_(function () {
    if (tx.transRef) {
      const dup = rows_().filter(function (r) { return r[8] === tx.transRef; })[0];
      if (dup) {
        const d = rowToTx_(dup);
        return { error: 'สลิปนี้บันทึกไปแล้ว (' + d.date + ', ' + d.amount + ' บาท)', duplicate: true };
      }
    }
    tx.slipFileId = saveSlip_(slip) || tx.slipFileId || '';
    writeRow_(sheet_().getLastRow() + 1, tx);
    return { item: tx };
  });
}

function update_(id, patch, slip) {
  return withLock_(function () {
    const rows = rows_();
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] !== id) continue;
      const tx = rowToTx_(rows[i]);
      ['date', 'type', 'amount', 'category', 'note', 'bank', 'transRef', 'account'].forEach(function (k) {
        if (patch && patch[k] !== undefined) tx[k] = patch[k];
      });
      if (tx.transRef) {
        const dup = rows.filter(function (r, j) { return j !== i && r[8] === tx.transRef; })[0];
        if (dup) return { error: 'เลขอ้างอิงนี้ซ้ำกับรายการอื่น', duplicate: true };
      }
      if (slip && slip.data) {
        if (tx.slipFileId) {
          try { DriveApp.getFileById(tx.slipFileId).setTrashed(true); } catch (err) {}
        }
        tx.slipFileId = saveSlip_(slip);
      }
      writeRow_(i + 2, tx);
      return { item: tx };
    }
    return { error: 'ไม่พบรายการ' };
  });
}

function delete_(id) {
  return withLock_(function () {
    const rows = rows_();
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === id) {
        const fileId = rows[i][9];
        sheet_().deleteRow(i + 2);
        if (fileId) {
          try { DriveApp.getFileById(fileId).setTrashed(true); } catch (err) {}
        }
        return { ok: true };
      }
    }
    return { error: 'ไม่พบรายการ' };
  });
}

function slip_(fileId) {
  const file = DriveApp.getFileById(fileId);
  const parents = file.getParents();
  const folderId = folder_().getId();
  let ok = false;
  while (parents.hasNext()) if (parents.next().getId() === folderId) ok = true;
  if (!ok) return { error: 'not found' };
  const blob = file.getBlob();
  return { mime: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) };
}

// ---------- PIN lockout ----------
// Wrong PIN 5 times -> locked 15 min; each further lock doubles (max 24 h). A correct PIN resets it.
const AUTH_MAX_FAILS = 5;
const AUTH_BASE_LOCK_MS = 15 * 60 * 1000;
const AUTH_MAX_LOCK_MS = 24 * 60 * 60 * 1000;

function auth_(op) {
  return withLock_(function () {
    const props = PropertiesService.getScriptProperties();
    let st = { fails: 0, level: 0, lockUntil: 0 };
    try { st = Object.assign(st, JSON.parse(props.getProperty('AUTH') || '{}')); } catch (err) {}
    const now = Date.now();
    const locked = st.lockUntil > now;
    if (op === 'fail' && !locked) {
      st.fails += 1;
      if (st.fails >= AUTH_MAX_FAILS) {
        st.level += 1;
        st.lockUntil = now + Math.min(AUTH_BASE_LOCK_MS * Math.pow(2, st.level - 1), AUTH_MAX_LOCK_MS);
        st.fails = 0;
      }
      props.setProperty('AUTH', JSON.stringify(st));
    } else if (op === 'ok') {
      st = { fails: 0, level: 0, lockUntil: 0 };
      props.setProperty('AUTH', JSON.stringify(st));
    }
    const isLocked = st.lockUntil > now;
    return {
      locked: isLocked,
      lockUntil: isLocked ? st.lockUntil : 0,
      remaining: isLocked ? 0 : AUTH_MAX_FAILS - st.fails,
    };
  });
}

// ---------- settings ----------

function getSettings_() {
  const raw = PropertiesService.getScriptProperties().getProperty('SETTINGS');
  let s = {};
  try { s = raw ? JSON.parse(raw) : {}; } catch (err) {}
  const out = {};
  Object.keys(DEFAULT_SETTINGS).forEach(function (k) { out[k] = DEFAULT_SETTINGS[k]; });
  Object.keys(s).forEach(function (k) { out[k] = s[k]; });
  return out;
}

function saveSettings_(s) {
  // the app validates settings before sending; keep every key so new settings work without a script update
  const clean = getSettings_();
  Object.keys(s || {}).forEach(function (k) { clean[k] = s[k]; });
  const raw = JSON.stringify(clean);
  if (raw.length > 8500) throw new Error('ตั้งค่ามากเกินไป ลองลดจำนวนหมวดหรือรายการประจำ');
  PropertiesService.getScriptProperties().setProperty('SETTINGS', raw);
  syncTriggers_(clean);
  return clean;
}

function syncTriggers_(s) {
  const existing = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'weeklySummary'; });
  if (s.weeklyEmail && existing.length === 0) {
    ScriptApp.newTrigger('weeklySummary').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(19).inTimezone(TZ).create();
  } else if (!s.weeklyEmail) {
    existing.forEach(function (t) { ScriptApp.deleteTrigger(t); });
  }
  // daily trigger keeps recurring items on time even if the app isn't opened
  const daily = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'dailyJob'; });
  if (s.recurring && s.recurring.length && daily.length === 0) {
    ScriptApp.newTrigger('dailyJob').timeBased().everyDays(1).atHour(6).inTimezone(TZ).create();
  } else if ((!s.recurring || !s.recurring.length) && daily.length) {
    daily.forEach(function (t) { ScriptApp.deleteTrigger(t); });
  }
}

// ---------- recurring ----------

function dailyJob() {
  runRecurring_();
}

function runRecurring_() {
  const s = getSettings_();
  if (!s.recurring || !s.recurring.length) return;
  const props = PropertiesService.getScriptProperties();
  let done = {};
  try { done = JSON.parse(props.getProperty('RECURRING_DONE') || '{}'); } catch (err) {}
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
      writeRow_(sheet_().getLastRow() + 1, tx);
      done[r.id] = ym;
      changed = true;
    });
  });
  if (changed) props.setProperty('RECURRING_DONE', JSON.stringify(done));
}

// ---------- weekly email ----------

function fmt_(n) {
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function weeklySummary() {
  runRecurring_();
  const s = getSettings_();
  const items = list_();
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
    return '<tr><td>' + c + '</td><td style="text-align:right">' + fmt_(byCat[c]) + '</td></tr>';
  }).join('');

  const monthCat = {};
  month.filter(function (t) { return t.type === 'expense'; }).forEach(function (t) {
    monthCat[t.category] = (monthCat[t.category] || 0) + t.amount;
  });
  const budgetRows = Object.keys(s.budgets || {}).filter(function (c) { return s.budgets[c] > 0; }).map(function (c) {
    const used = monthCat[c] || 0;
    const pct = Math.round((used / s.budgets[c]) * 100);
    const color = pct >= 100 ? '#b4452f' : pct >= 80 ? '#c98a12' : '#0f7a52';
    return '<tr><td>' + c + '</td><td style="text-align:right;color:' + color + '">' + fmt_(used) + ' / ' + fmt_(s.budgets[c]) + ' (' + pct + '%)</td></tr>';
  }).join('');

  const html =
    '<div style="font-family:sans-serif;max-width:480px">' +
    '<h2 style="color:#0d5c46">เป๋าตังค์ — สรุปสัปดาห์</h2>' +
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
    '</div>';

  const pdf = fetchReportPdf_(from, to);
  const note = pdf
    ? '<p style="color:#9a7d94;font-size:13px">📎 แนบ PDF สรุปรายการทั้งหมดมาด้วย — รหัสผ่านเปิดไฟล์คือ PIN เดียวกับที่ใช้เข้าแอป</p>'
    : '<p style="color:#9a7d94;font-size:13px">ดู/ดาวน์โหลด PDF ได้ที่แอป → ตั้งค่า → สรุป PDF</p>';
  const mail = {
    to: Session.getEffectiveUser().getEmail(),
    subject: 'เป๋าตังค์ · สรุปสัปดาห์ ' + from + ' – ' + to,
    htmlBody: html.replace(/<\/div>$/, note + '</div>'),
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

// asks the Vercel app for the (password-protected) PDF; returns a blob or null — the email still goes out without it
function fetchReportPdf_(from, to) {
  const base = PropertiesService.getScriptProperties().getProperty('APP_URL');
  if (!base) return null;
  try {
    const res = UrlFetchApp.fetch(base + '/api/report?from=' + from + '&to=' + to, {
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
