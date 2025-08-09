// old.module.js — גרסה שעובדת עם OAuth + sheets.js (בלי Apps Script, בלי API key)


import { valuesGet, valuesAppend, valuesUpdate, deleteRow } from './sheets.js';


// --- הגדרות כלליות ---
let selectedCategory = null;
let monthTransactions = []; // תנועות של החודש הנוכחי כולל מספר שורה למחיקה
let selectedMode = 'one_time';  // one_time | fixed | installments

const SHEET_NAME = 'Sheet1'; // ✏️ עדכן לשם הטאב אצלך
const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();

function showScreen(screen) {
  if (screen === 'add') {
    const el = document.getElementById('screen-add');
    if (el) el.style.display = 'flex';
  }
  if (screen === 'kids') {
    const el = document.getElementById('screen-kids');
    if (el) el.style.display = 'block';
    loadKids();
    loadKidsLog();
    return;
  }
}
window.showScreen = showScreen;

function hideAddScreen() {
  const el = document.getElementById('screen-add');
  if (el) el.style.display = 'none';
}
window.hideAddScreen = hideAddScreen;

function updateMonthTitle() {
  const el = document.getElementById('month-title');
  if (el) el.textContent = `${months[currentMonth]} ${currentYear}`;
}
window.prevMonth = function prevMonth() {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  loadExpenses();
}
window.nextMonth = function nextMonth() {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  loadExpenses();
}

// ========== DATA LOGIC ==========
async function loadExpenses() {
  updateMonthTitle();

  const range = `${SHEET_NAME}!A:H`;
  const values = await valuesGet(range);

  const rows = values || [];
  let income = 0, expense = 0;
  monthTransactions = [];

  // אם יש כותרות בשורה 1, מדלגים
  const bodyRows = rows[0] && rows[0][0] && String(rows[0][0]).toLowerCase() === 'date'
    ? rows.slice(1)
    : rows;

  bodyRows.forEach((row, i) => {
    const sheetRow = (rows.length === bodyRows.length) ? (i + 1) : (i + 2); // אם יש כותרת, מתחילים מ-2
    const date = row[0] || '';
    if (!date) return;

    const d = new Date(date);
    if (d.getFullYear() !== currentYear || d.getMonth() !== currentMonth) return;

    const amount = Number(row[1]) || 0;
    const description = row[2] || '';
    const type = row[3] || 'expense';
    const category = row[4] || '';
    const mode = row[5] || '';
    const instTotal = row[6] || '';
    const instLeft  = row[7] || '';

    if (type === 'income') income += amount; else expense += amount;

    monthTransactions.push({ row: sheetRow, date, amount, description, type, category, mode, instTotal, instLeft });
  });

  const inc = document.getElementById('income-summary');
  const exp = document.getElementById('expense-summary');
  const sts = document.getElementById('safe-to-spend');
  const dl  = document.getElementById('days-left');
  if (inc) inc.textContent = `₪ ${income.toLocaleString()}`;
  if (exp) exp.textContent = `₪ ${expense.toLocaleString()}`;
  if (sts) sts.textContent = `₪ ${(income - expense).toLocaleString()}`;
  if (dl)  dl.textContent  = `${daysLeftInMonth()} days left`;

  renderDonut(income, expense);
}
window.loadExpenses = loadExpenses;

// ========== DONUT CHART ==========
let chart = null;
function renderDonut(income, expense) {
  const canvas = document.getElementById('circle-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (chart) chart.destroy();
  // Chart.js צריך להיות טעון ב-HTML
  // eslint-disable-next-line no-undef
  chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [income, expense],
        backgroundColor: ['#22c55e', '#ef4444'],
        borderWidth: 0,
      }],
      labels: ['Income', 'Expense']
    },
    options: {
      cutout: "75%",
      plugins: { legend: { display: false } },
      responsive: false,
      maintainAspectRatio: false,
    }
  });
}

// ========== UTIL ==========
function daysLeftInMonth() {
  const today = new Date(currentYear, currentMonth, new Date().getDate());
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  return lastDay.getDate() - today.getDate() + 1;
}

async function showLoader() {
  const overlay = document.getElementById('loader-overlay');
  if (overlay) overlay.style.display = 'flex';
  await loadLoadingMessagesOnce();
  const msgEl = document.getElementById('loader-message');
  if (msgEl) msgEl.textContent = pickLoadingMessage();
}
function hideLoader() {
  const overlay = document.getElementById('loader-overlay');
  if (overlay) overlay.style.display = 'none';
}

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', function() {
  const dateEl = document.getElementById('date');
  if (dateEl) dateEl.valueAsDate = new Date();
  loadExpenses();
});

// Toggle הוצאה/הכנסה
const btnExpense = document.getElementById('btn-expense');
const btnIncome  = document.getElementById('btn-income');
if (btnExpense) btnExpense.addEventListener('click', function() {
  const typeEl = document.getElementById('type');
  if (typeEl) typeEl.value = 'expense';
  this.className = "toggle-type px-5 py-2 rounded-l-xl font-bold bg-blue-100 text-blue-700 border border-blue-200";
  if (btnIncome) btnIncome.className = "toggle-type px-5 py-2 rounded-r-xl font-bold bg-gray-100 text-gray-400 border border-blue-200";
  const picker = document.getElementById('category-picker');
  if (picker) picker.style.display = 'grid';
});
if (btnIncome) btnIncome.addEventListener('click', function() {
  const typeEl = document.getElementById('type');
  if (typeEl) typeEl.value = 'income';
  this.className = "toggle-type px-5 py-2 rounded-r-xl font-bold bg-green-100 text-green-700 border border-green-200";
  if (btnExpense) btnExpense.className = "toggle-type px-5 py-2 rounded-l-xl font-bold bg-gray-100 text-gray-400 border border-blue-200";
  const picker = document.getElementById('category-picker');
  if (picker) picker.style.display = 'none';
  const catInput = document.getElementById('category');
  if (catInput) catInput.value = '';
  selectedCategory = null;
  document.querySelectorAll('.cat-btn').forEach(btn=>btn.classList.remove('bg-green-200','ring-2','ring-green-400'));
});

// מצב הוצאה (חד פעמית / קבועה / תשלומים)
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedMode = btn.dataset.mode;                     // one_time | fixed | installments
    const modeEl = document.getElementById('expense_mode');
    if (modeEl) modeEl.value = selectedMode;

    document.querySelectorAll('.mode-btn').forEach(b => b.className =
      'mode-btn px-3 py-2 rounded-xl bg-gray-100 text-gray-400 border border-blue-200');
    btn.className = 'mode-btn px-3 py-2 rounded-xl bg-blue-100 text-blue-700 border border-blue-200';

    const inst = document.getElementById('installments-fields');
    if (inst) {
      if (selectedMode === 'installments') inst.classList.remove('hidden');
      else inst.classList.add('hidden');
    }
  });
});

// בחירת קטגוריה
document.querySelectorAll('.cat-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('bg-green-200','ring-2','ring-green-400'));
    this.classList.add('bg-green-200','ring-2','ring-green-400');
    const catInput = document.getElementById('category');
    if (catInput) catInput.value = this.dataset.category;
    selectedCategory = this.dataset.category;
  });
});

// ולידציה ושליחה (valuesAppend במקום Apps Script)
const expenseForm = document.getElementById('expense-form');
if (expenseForm) expenseForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  await showLoader();

  const typeEl = document.getElementById('type');
  if (typeEl && typeEl.value === 'expense' && !selectedCategory){
    alert('חובה לבחור קטגוריה');
    hideLoader();
    return false;
  }

  const date = document.getElementById('date')?.value;
  let amountStr = document.getElementById('amount')?.value.trim().replace(',', '.');
  const amount = parseFloat(amountStr);
  if (!isFinite(amount)) { alert('סכום לא חוקי'); hideLoader(); return; }

  const description = document.getElementById('desc')?.value;
  const type = document.getElementById('type')?.value;
  const category = selectedCategory;

  const modeEl = document.getElementById('expense_mode');
  const mode = modeEl ? modeEl.value : 'one_time'; // one_time | fixed | installments
  let installments_total = '';
  let installments_left = '';

  if (type === 'expense' && mode === 'installments') {
    installments_total = document.getElementById('installments_total')?.value;
    installments_left  = document.getElementById('installments_left')?.value;
    if (!installments_total) { alert('הכנס סה״כ תשלומים'); hideLoader(); return false; }
    if (installments_left === '') installments_left = installments_total;
  }

  const row = [date, amount, description, type, category, mode, installments_total, installments_left];

  try {
    await valuesAppend(`${SHEET_NAME}!A:H`, [row]);
    await loadExpenses();
    expenseForm.reset();
    selectedCategory = null;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('bg-green-200','ring-2','ring-green-400'));
    hideAddScreen();
  } catch (error) {
    console.error(error);
    alert("ארעה שגיאה בשליחה. נסה שוב.");
  } finally {
    hideLoader();
  }
});

// --- רשימת חודש + מחיקה ---
function showList() {
  const listScreen = document.getElementById('screen-list');
  const listEl = document.getElementById('list-transactions');
  const titleEl = document.getElementById('list-title');

  if (!listScreen || !listEl) {
    console.error('Missing #screen-list or #list-transactions in HTML');
    alert('רכיבי הרשימה לא נמצאו ב-HTML. עדכן IDs או תן לי את ה-HTML לבדיקה.');
    return;
  }
  if (titleEl) titleEl.textContent = `${months[currentMonth]} ${currentYear} — כל התנועות`;
  renderList();
  listScreen.style.display = 'flex';
}
window.showList = showList;

window.hideList = function hideList() {
  const screen = document.getElementById('screen-list');
  if (screen) screen.style.display = 'none';
}

function renderList() {
  const ul = document.getElementById('list-transactions');
  if (!ul) return;
  ul.innerHTML = '';

  const sorted = [...monthTransactions]
    .sort((a,b) => new Date(b.date) - new Date(a.date) || b.row - a.row);

  sorted.forEach(tx => {
    const color = tx.type === 'income' ? 'text-green-600' : 'text-red-500';
    let modeLabel = '';
    if (tx.type === 'expense') {
      if (tx.mode === 'fixed')       modeLabel = 'קבועה';
      else if (tx.mode === 'installments') {
        const left  = tx.instLeft  ?? tx.inst_left  ?? tx.installments_left  ?? 0;
        const total = tx.instTotal ?? tx.inst_total ?? tx.installments_total ?? 0;
        modeLabel = `תשלומים: נשאר ${left}/${total}`;
      } else                          modeLabel = 'חד פעמית';
    }

    ul.insertAdjacentHTML('beforeend', `
      <li class="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
        <div class="flex items-center gap-2">
          <span class="text-2xl ${tx.type==='income'?'text-green-500':'text-red-400'}">
            ${tx.type==='income' ? '⬆️' : '⬇️'}
          </span>
          <div>
            <div class="font-semibold">
              ${tx.description || ''} ${tx.category ? `<span class="text-xs text-gray-500">• ${tx.category}</span>` : ''}
            </div>
            <div class="text-xs text-gray-400">${tx.date}</div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="font-bold ${color} whitespace-nowrap">₪ ${Number(tx.amount).toLocaleString()}</div>
          <span class="text-xs px-2 py-1 rounded-full bg-gray-200 ${tx.type==='income' ? 'hidden' : ''}">
            ${modeLabel}
          </span>
          <button class="text-red-500 hover:text-red-700" title="מחיקה" onclick="confirmDelete(${tx.row})">🗑️</button>
        </div>
      </li>
    `);
  });
}

window.confirmDelete = async function confirmDelete(row) {
  if (!confirm('למחוק את הרשומה?')) return;
  await showLoader();
  try {
    await deleteRow(SHEET_NAME, row);
    await loadExpenses();
    renderList();
  } catch (e) {
    console.error(e);
    alert('מחיקה נכשלה');
  } finally {
    hideLoader();
  }
}

// --- ילדים ---
async function loadKids() {
  const rows = await valuesGet('Kids!A:C');
  const body = rows.slice(1); // להסיר כותרת
  const grid = document.getElementById('kids-grid');
  if (!grid) return;
  grid.innerHTML = '';
  body.forEach(r => {
    const kidId = r[0] || '';
    const name  = r[1] || '';
    const bal   = Number(r[2] || 0);
    grid.innerHTML += `
      <div class="rounded-xl border p-3 shadow-sm">
        <div class="font-semibold mb-1">${name}</div>
        <div class="text-sm text-gray-500 mb-2">יתרה: <span class="font-bold">₪ ${bal.toLocaleString()}</span></div>
        <div class="flex gap-2">
          <button class="flex-1 bg-green-500 text-white rounded py-1" onclick="openAdjustModal('${kidId}','${name}', 'add')">הוספה</button>
          <button class="flex-1 bg-red-500 text-white rounded py-1" onclick="openAdjustModal('${kidId}','${name}', 'sub')">הורדה</button>
        </div>
      </div>`;
  });
}
window.loadKids = loadKids;

async function loadKidsLog(limit = 20) {
  const rows = await valuesGet('KidsLog!A:F');
  const body = rows.slice(1).reverse().slice(0, limit);
  const ul = document.getElementById('kids-log');
  if (!ul) return;
  ul.innerHTML = '';
  body.forEach(r => {
    const ts    = r[0] || '';
    const name  = r[2] || '';
    const delta = Number(r[3] || 0);
    const note  = r[4] || '';
    const after = Number(r[5] || 0);
    ul.innerHTML += `
      <li class="bg-gray-50 rounded-xl px-3 py-2 flex justify-between items-center text-sm">
        <div>
          <div class="font-medium">${name} — ${delta >= 0 ? 'הוספה' : 'הורדה'} ₪ ${Math.abs(delta).toLocaleString()}</div>
          <div class="text-gray-400">${ts} ${note ? '• ' + note : ''}</div>
        </div>
        <div class="text-gray-600">אחרי: ₪ ${after.toLocaleString()}</div>
      </li>`;
  });
}
window.loadKidsLog = loadKidsLog;

async function findKidRowById(kidId) {
  const rows = await valuesGet('Kids!A:C');
  for (let i=1;i<rows.length;i++) {
    if ((rows[i][0]||'') === kidId) return { row: i+1, current: Number(rows[i][2]||0), name: rows[i][1]||'' };
  }
  throw new Error('kid not found: '+kidId);
}

async function saveKidsLog({ kidId, name, amount, note }) {
  try {
    await showLoader();
    // 1) עדכון יתרה ב-Kids
    const { row, current } = await findKidRowById(kidId);
    const after = current + amount;
    await valuesUpdate(`Kids!C${row}:C${row}`, [[after]]);

    // 2) הוספת רשומה ל- KidsLog: Timestamp | kidId | name | delta | note | after
    const ts = new Date().toISOString();
    await valuesAppend('KidsLog!A:F', [[ts, kidId, name, amount, note || '', after]]);

    // רענון תצוגה
    await loadKids();
    await loadKidsLog();
  } catch (e) {
    console.error(e);
    alert('שגיאה בעדכון. נסה שוב.');
  } finally {
    hideLoader();
  }
}

// --- מודל ילדים ---
let currentKidId = null;
let currentKidName = "";
let currentKidsMode = "add"; // add | sub

window.openAdjustModal = function openAdjustModal(kidId, name, mode = "add") {
  currentKidId = kidId;
  currentKidName = name;
  currentKidsMode = mode === "sub" ? "sub" : "add";
  const lbl = document.getElementById('kids-modal-name');
  if (lbl) lbl.textContent = name;
  const amountEl = document.getElementById('kids-amount');
  if (amountEl) amountEl.value = "";
  const noteEl = document.getElementById('kids-note');
  if (noteEl) noteEl.value = "";
  setKidsMode(currentKidsMode);
  const modal = document.getElementById('kids-modal');
  if (modal) modal.classList.remove('hidden');
}
window.closeKidsModal = function closeKidsModal() {
  const modal = document.getElementById('kids-modal');
  if (modal) modal.classList.add('hidden');
  currentKidId = null;
  currentKidName = "";
}

function setKidsMode(mode) {
  currentKidsMode = mode;
  const addBtn = document.getElementById('kids-mode-add');
  const subBtn = document.getElementById('kids-mode-sub');
  if (!addBtn || !subBtn) return;
  if (mode === 'add') {
    addBtn.className = "px-5 py-2 rounded-l-xl font-bold bg-green-100 text-green-700 border border-green-200";
    subBtn.className = "px-5 py-2 rounded-r-xl font-bold bg-gray-100 text-gray-400 border border-green-200";
  } else {
    subBtn.className = "px-5 py-2 rounded-r-xl font-bold bg-red-100 text-red-700 border border-red-200";
    addBtn.className = "px-5 py-2 rounded-l- xl font-bold bg-gray-100 text-gray-400 border border-green-200";
  }
}
window.setKidsMode = setKidsMode;

const modeAdd = document.getElementById('kids-mode-add');
const modeSub = document.getElementById('kids-mode-sub');
if (modeAdd) modeAdd.addEventListener('click', () => setKidsMode('add'));
if (modeSub) modeSub.addEventListener('click', () => setKidsMode('sub'));

window.submitKidsAdjust = async function submitKidsAdjust() {
  const amountRaw = Number(document.getElementById('kids-amount')?.value);
  const note = document.getElementById('kids-note')?.value || "";
  if (!currentKidId || !currentKidName) { alert('חסרים פרטי ילד'); return; }
  if (!amountRaw || amountRaw <= 0) { alert('הכנס סכום חוקי'); return; }
  const delta = currentKidsMode === 'sub' ? -Math.abs(amountRaw) : Math.abs(amountRaw);
  await saveKidsLog({ kidId: currentKidId, name: currentKidName, amount: delta, note });
  closeKidsModal();
}
function hideKidsScreen() {
  const el = document.getElementById('screen-kids');
  if (el) el.style.display = 'none';
  // אם יש מודל פתוח – נסגור גם אותו
  const modal = document.getElementById('kids-modal');
  if (modal) modal.classList.add('hidden');
}
window.hideKidsScreen = hideKidsScreen;

// ---- הודעות טעינה מהגיליון ----
const LOADING_SHEET_NAME = 'LoadingMessages';
let loadingMessages = [];
const LOADING_FALLBACKS = [
  'טוען… תיכף חוזרים אליך',
  'מחשב את הקסם…',
  'שומר את הקבלה בארכיון 🧾',
  'מסדר את המספרים בשורה אחת…',
  'תכף זה קורה…'
];

async function loadLoadingMessagesOnce() {
  if (loadingMessages.length) return;
  try {
    const rows = await valuesGet(`${LOADING_SHEET_NAME}!A:A`);
    loadingMessages = rows
      .map(r => (r && r[0]) ? String(r[0]).trim() : '')
      .filter(Boolean)
      .filter(s => s.toLowerCase() !== 'message');
  } catch (e) {
    console.warn('Loading messages fetch failed:', e);
  }
}
function pickLoadingMessage() {
  const pool = loadingMessages.length ? loadingMessages : LOADING_FALLBACKS;
  return pool[Math.floor(Math.random() * pool.length)];
}
