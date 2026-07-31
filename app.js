(function () {
  "use strict";

  // ---------- Data ----------
  const STORAGE_KEY = "canjar_transactions_v1";
  const CURRENCY_KEY = "canjar_currency_v1";
  const BUDGET_KEY = "canjar_budgets_v1";

  const CATEGORIES = {
    expense: [
      { id: "food", label: "餐飲", icon: "🍚" },
      { id: "transport", label: "交通", icon: "🚗" },
      { id: "shopping", label: "購物", icon: "🛍" },
      { id: "fun", label: "娛樂", icon: "🎮" },
      { id: "home", label: "居家", icon: "🏠" },
      { id: "medical", label: "醫療", icon: "💊" },
      { id: "edu", label: "教育", icon: "📚" },
      { id: "travel", label: "旅行", icon: "✈️" },
      { id: "comm", label: "通訊", icon: "📱" },
      { id: "pet", label: "寵物", icon: "🐾" },
      { id: "gift", label: "送禮", icon: "🎁" },
      { id: "other_e", label: "其他", icon: "📦" },
      { id: "car", label: "座駕", icon: "🚙" },
      { id: "beauty", label: "美容美睫", icon: "💅" },
      { id: "savings", label: "儲蓄", icon: "🐷" },
      { id: "stock", label: "股票", icon: "💹" },
    ],
    income: [
      { id: "salary", label: "薪資", icon: "💰" },
      { id: "bonus", label: "獎金", icon: "🏆" },
      { id: "invest", label: "投資", icon: "📈" },
      { id: "parttime", label: "兼職", icon: "💼" },
      { id: "redpocket", label: "紅包", icon: "🧧" },
      { id: "other_i", label: "其他", icon: "📦" },
    ],
  };

  const CAT_COLORS = ["#5FBB97", "#F0AD4E", "#E8735B", "#7BA9E8", "#C08FE8",
    "#E8C15F", "#5FC7E8", "#E85F9B", "#8FBB5F", "#BB8F5F", "#5F8FE8", "#B0B0B0",
    "#4F9DA6", "#D65FA0", "#C9A227", "#6C5CE7"];

  function loadTx() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveTx(list) { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }

  function loadBudgets() {
    let raw;
    try { raw = JSON.parse(localStorage.getItem(BUDGET_KEY)) || {}; }
    catch (e) { raw = {}; }
    // migrate old flat {catId: amount} format: treat it as this month's budget only
    const firstVal = raw[Object.keys(raw)[0]];
    if (typeof firstVal === "number") {
      const d = new Date();
      raw = { [`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`]: raw };
    }
    return raw;
  }
  function saveBudgets() { localStorage.setItem(BUDGET_KEY, JSON.stringify(budgets)); }

  // budgets is keyed by "YYYY-MM"; each month's budget is independent — setting
  // a budget for one month does NOT carry over to other months.
  function getEffectiveBudgets(monthDate) {
    return budgets[ymKey(monthDate)] || {};
  }

  let transactions = loadTx();
  let currency = localStorage.getItem(CURRENCY_KEY) || "HK$";
  let budgets = loadBudgets();

  // ---------- State ----------
  let currentMonth = new Date();
  currentMonth.setDate(1);
  let currentView = "home";
  let addType = "expense";
  let selectedCat = null;
  let amountStr = "0";
  let statsType = "expense";

  // ---------- Helpers ----------
  function fmtMonth(d) { return `${d.getFullYear()}年${d.getMonth() + 1}月`; }
  function ymKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
  function fmtNum(n) {
    return Math.round(n).toLocaleString("en-US");
  }
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function catInfo(type, id) {
    return CATEGORIES[type].find((c) => c.id === id) || { label: id, icon: "📦" };
  }
  function txForMonth(monthDate) {
    const key = ymKey(monthDate);
    return transactions.filter((t) => t.date.startsWith(key));
  }
  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 1600);
  }

  // ---------- Rendering: Home ----------
  function renderHome() {
    document.getElementById("monthLabel").textContent = fmtMonth(currentMonth);
    const list = txForMonth(currentMonth);
    let income = 0, expense = 0;
    list.forEach((t) => { if (t.type === "income") income += t.amount; else expense += t.amount; });
    document.getElementById("sumIncome").textContent = currency + fmtNum(income);
    document.getElementById("sumExpense").textContent = currency + fmtNum(expense);
    document.getElementById("sumBalance").textContent = currency + fmtNum(income - expense);

    renderBudgetProgress(list);

    const byDay = {};
    list.forEach((t) => { (byDay[t.date] = byDay[t.date] || []).push(t); });
    const days = Object.keys(byDay).sort((a, b) => (a < b ? 1 : -1));

    const txListEl = document.getElementById("txList");
    const emptyEl = document.getElementById("emptyState");
    txListEl.innerHTML = "";

    if (days.length === 0) {
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;

    days.forEach((day) => {
      const items = byDay[day].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      let dayTotal = 0;
      items.forEach((t) => { dayTotal += t.type === "income" ? t.amount : -t.amount; });

      const dayWrap = document.createElement("div");
      dayWrap.className = "tx-day";
      const d = new Date(day + "T00:00:00");
      const weekday = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
      dayWrap.innerHTML = `
        <div class="tx-day-header">
          <span>${d.getMonth() + 1}月${d.getDate()}日 週${weekday}</span>
          <span class="tx-day-total">${dayTotal >= 0 ? "+" : "-"}${currency}${fmtNum(Math.abs(dayTotal))}</span>
        </div>
        <div class="tx-card"></div>
      `;
      const card = dayWrap.querySelector(".tx-card");
      items.forEach((t) => {
        const ci = catInfo(t.type, t.category);
        const row = document.createElement("div");
        row.className = "tx-row";
        row.innerHTML = `
          <div class="tx-icon">${ci.icon}</div>
          <div class="tx-info">
            <div class="tx-cat">${ci.label}</div>
            ${t.note ? `<div class="tx-note">${escapeHtml(t.note)}</div>` : ""}
          </div>
          <div class="tx-amount ${t.type}">${t.type === "income" ? "+" : "-"}${currency}${fmtNum(t.amount)}</div>
        `;
        row.addEventListener("click", () => {
          if (confirm(`刪除「${ci.label} ${currency}${fmtNum(t.amount)}」這筆記錄？`)) {
            transactions = transactions.filter((x) => x.id !== t.id);
            saveTx(transactions);
            renderAll();
          }
        });
        card.appendChild(row);
      });
      txListEl.appendChild(dayWrap);
    });
  }

  function renderBudgetProgress(monthList) {
    const wrap = document.getElementById("budgetProgress");
    const activeBudgets = getEffectiveBudgets(currentMonth);
    const budgetIds = Object.keys(activeBudgets).filter((id) => activeBudgets[id] > 0);
    if (budgetIds.length === 0) { wrap.innerHTML = ""; return; }

    const spentByCat = {};
    monthList.forEach((t) => {
      if (t.type !== "expense") return;
      spentByCat[t.category] = (spentByCat[t.category] || 0) + t.amount;
    });

    const order = CATEGORIES.expense.map((c) => c.id).filter((id) => budgetIds.includes(id));
    wrap.innerHTML = order.map((id) => {
      const info = catInfo("expense", id);
      const budget = activeBudgets[id];
      const spent = spentByCat[id] || 0;
      const pct = (spent / budget) * 100;
      const over = spent > budget;
      return `
        <div class="bp-row">
          <div class="bp-top">
            <span class="bp-left">${info.icon} ${info.label}</span>
            <span class="bp-nums">${currency}${fmtNum(spent)} / ${currency}${fmtNum(budget)}
              <span class="${over ? "over" : ""}">${over ? " 超支！" : ""}</span>
            </span>
          </div>
          <div class="cat-bar-bg"><div class="cat-bar-fill" style="width:${Math.min(pct, 100)}%;background:${over ? "#E8735B" : "#5FBB97"}"></div></div>
        </div>
      `;
    }).join("");
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  // ---------- Rendering: Stats ----------
  function renderStats() {
    document.getElementById("monthLabelStats").textContent = fmtMonth(currentMonth);
    const list = txForMonth(currentMonth).filter((t) => t.type === statsType);
    const totals = {};
    let grand = 0;
    list.forEach((t) => {
      totals[t.category] = (totals[t.category] || 0) + t.amount;
      grand += t.amount;
    });
    const cats = CATEGORIES[statsType];
    const entries = Object.entries(totals)
      .map(([id, amt]) => ({ id, amt, info: catInfo(statsType, id) }))
      .sort((a, b) => b.amt - a.amt);

    document.getElementById("chartTotal").textContent = currency + fmtNum(grand);

    drawPie(entries, grand);
    renderBudgetSummary(grand);

    const wrap = document.getElementById("catBreakdown");
    wrap.innerHTML = "";
    if (entries.length === 0) {
      wrap.innerHTML = `<div class="stats-empty">這個月還沒有${statsType === "expense" ? "支出" : "收入"}紀錄</div>`;
      return;
    }
    const activeBudgets = getEffectiveBudgets(currentMonth);
    entries.forEach((e, i) => {
      const pct = grand ? ((e.amt / grand) * 100) : 0;
      const color = CAT_COLORS[cats.findIndex((c) => c.id === e.id) % CAT_COLORS.length];
      const budget = statsType === "expense" ? activeBudgets[e.id] : null;
      let budgetHtml = "";
      if (budget) {
        const bpct = (e.amt / budget) * 100;
        const over = e.amt > budget;
        budgetHtml = `
          <div class="budget-line">
            <span>預算 ${currency}${fmtNum(budget)}</span>
            <span class="${over ? "over" : ""}">${bpct.toFixed(0)}%${over ? " 超支" : ""}</span>
          </div>
          <div class="cat-bar-bg budget-bar-bg"><div class="cat-bar-fill" style="width:${Math.min(bpct, 100)}%;background:${over ? "#E8735B" : "#5FBB97"}"></div></div>
        `;
      }
      const row = document.createElement("div");
      row.className = "cat-row";
      row.innerHTML = `
        <div class="cat-row-top">
          <div class="cat-row-left"><span class="cat-row-icon">${e.info.icon}</span>${e.info.label}
            <span class="cat-row-pct">${pct.toFixed(1)}%</span>
          </div>
          <div>${currency}${fmtNum(e.amt)}</div>
        </div>
        <div class="cat-bar-bg"><div class="cat-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        ${budgetHtml}
      `;
      wrap.appendChild(row);
    });
  }

  function renderBudgetSummary(grandExpense) {
    const el = document.getElementById("budgetSummary");
    if (statsType !== "expense") { el.hidden = true; return; }
    const activeBudgets = getEffectiveBudgets(currentMonth);
    const totalBudget = CATEGORIES.expense.reduce((sum, c) => sum + (activeBudgets[c.id] || 0), 0);
    if (!totalBudget) { el.hidden = true; return; }
    el.hidden = false;
    const pct = (grandExpense / totalBudget) * 100;
    const over = grandExpense > totalBudget;
    el.innerHTML = `
      <div class="budget-summary-top">
        <span class="label">本月預算</span>
        <span class="value">${currency}${fmtNum(totalBudget)}</span>
      </div>
      <div class="budget-summary-top">
        <span class="label">已花費</span>
        <span class="value ${over ? "over" : ""}">${currency}${fmtNum(grandExpense)} (${pct.toFixed(0)}%)</span>
      </div>
      <div class="cat-bar-bg"><div class="cat-bar-fill" style="width:${Math.min(pct, 100)}%;background:${over ? "#E8735B" : "#5FBB97"}"></div></div>
    `;
  }

  function buildBudgetList() {
    document.getElementById("budgetMonthLabel").textContent = fmtMonth(currentMonth);

    const activeBudgets = getEffectiveBudgets(currentMonth);
    const hintEl = document.getElementById("budgetHint");
    hintEl.textContent = Object.keys(activeBudgets).length
      ? "僅套用於此月份"
      : "尚未設定此月份的預算";

    const totalRow = document.getElementById("budgetTotalRow");
    const total = CATEGORIES.expense.reduce((sum, c) => sum + (activeBudgets[c.id] || 0), 0);
    totalRow.hidden = total <= 0;
    document.getElementById("budgetTotalValue").textContent = currency + fmtNum(total);

    const wrap = document.getElementById("budgetList");
    wrap.innerHTML = "";
    CATEGORIES.expense.forEach((c) => {
      const row = document.createElement("div");
      row.className = "budget-row";
      row.innerHTML = `
        <span class="cat-row-icon">${c.icon}</span>
        <span class="budget-cat-label">${c.label}</span>
        <span class="budget-currency">${currency}</span>
        <input type="number" inputmode="decimal" min="0" step="1" placeholder="0" value="${activeBudgets[c.id] || ""}">
      `;
      const input = row.querySelector("input");
      input.addEventListener("change", () => {
        const v = parseFloat(input.value);
        const monthKey = ymKey(currentMonth);
        const monthBudgets = { ...(budgets[monthKey] || {}) };
        if (!v || v <= 0) delete monthBudgets[c.id];
        else monthBudgets[c.id] = v;
        budgets[monthKey] = monthBudgets;
        saveBudgets();
        buildBudgetList();
        if (currentView === "home") renderHome();
        if (currentView === "stats") renderStats();
      });
      wrap.appendChild(row);
    });
  }

  function drawPie(entries, grand) {
    const canvas = document.getElementById("pieCanvas");
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, rOuter = w / 2 - 6, rInner = rOuter * 0.62;

    if (!grand || entries.length === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
      ctx.fillStyle = "#F0EBDD";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
      const isDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      ctx.fillStyle = isDark ? "#1C1C1E" : "#FFFBF2";
      ctx.fill();
      return;
    }
    const cats = CATEGORIES[statsType];
    let start = -Math.PI / 2;
    entries.forEach((e) => {
      const slice = (e.amt / grand) * Math.PI * 2;
      const color = CAT_COLORS[cats.findIndex((c) => c.id === e.id) % CAT_COLORS.length];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, rOuter, start, start + slice);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      start += slice;
    });
    ctx.beginPath();
    ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
    const isDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    ctx.fillStyle = isDark ? "#1C1C1E" : "#FFFBF2";
    ctx.fill();
  }

  // ---------- View switching ----------
  function showView(view) {
    currentView = view;
    ["home", "stats", "settings"].forEach((v) => {
      document.getElementById("view-" + v).hidden = v !== view;
    });
    document.querySelectorAll(".nav-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.view === view);
    });
    if (view === "home") renderHome();
    if (view === "stats") renderStats();
  }

  function renderAll() {
    renderHome();
    if (currentView === "stats") renderStats();
  }

  // ---------- Add sheet ----------
  function buildCatGrid() {
    const grid = document.getElementById("catGrid");
    grid.innerHTML = "";
    CATEGORIES[addType].forEach((c) => {
      const btn = document.createElement("button");
      btn.className = "cat-item" + (selectedCat === c.id ? " selected" : "");
      btn.innerHTML = `<span class="cat-icon">${c.icon}</span><span>${c.label}</span>`;
      btn.addEventListener("click", () => {
        selectedCat = c.id;
        buildCatGrid();
      });
      grid.appendChild(btn);
    });
  }

  function openAddSheet() {
    addType = "expense";
    selectedCat = null;
    amountStr = "0";
    document.getElementById("noteInput").value = "";
    document.getElementById("dateInput").value = todayStr();
    document.getElementById("amountCurrency").textContent = currency;
    updateTypeButtons();
    updateAmountDisplay();
    buildCatGrid();
    document.getElementById("addSheet").hidden = false;
  }
  function closeAddSheet() {
    document.getElementById("addSheet").hidden = true;
  }
  function updateTypeButtons() {
    document.querySelectorAll(".type-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.type === addType);
    });
  }
  function updateAmountDisplay() {
    let display = amountStr;
    if (display.length > 1) display = display.replace(/^0+(?=\d)/, "");
    document.getElementById("amountValue").textContent = display;
  }

  function saveTransaction() {
    const amount = parseFloat(amountStr);
    if (!amount || amount <= 0) { toast("請輸入金額"); return; }
    if (!selectedCat) { toast("請選擇分類"); return; }
    const date = document.getElementById("dateInput").value || todayStr();
    const note = document.getElementById("noteInput").value.trim();
    transactions.push({
      id: Date.now() + "-" + Math.random().toString(36).slice(2, 8),
      type: addType,
      category: selectedCat,
      amount,
      note,
      date,
      createdAt: Date.now(),
    });
    saveTx(transactions);
    closeAddSheet();
    renderAll();
    toast("已儲存");
  }

  // ---------- Events ----------
  document.querySelectorAll(".nav-btn").forEach((b) => {
    b.addEventListener("click", () => showView(b.dataset.view));
  });
  document.getElementById("openAdd").addEventListener("click", openAddSheet);
  document.getElementById("cancelAdd").addEventListener("click", closeAddSheet);
  document.getElementById("saveAdd").addEventListener("click", saveTransaction);

  document.querySelectorAll(".type-btn").forEach((b) => {
    b.addEventListener("click", () => {
      addType = b.dataset.type;
      selectedCat = null;
      updateTypeButtons();
      buildCatGrid();
    });
  });

  document.querySelectorAll(".keypad button").forEach((b) => {
    b.addEventListener("click", () => {
      const k = b.dataset.k;
      if (k === "back") {
        amountStr = amountStr.length > 1 ? amountStr.slice(0, -1) : "0";
      } else if (k === ".") {
        if (!amountStr.includes(".")) amountStr += ".";
      } else {
        if (amountStr === "0") amountStr = k;
        else {
          const parts = amountStr.split(".");
          if (parts[1] && parts[1].length >= 2) return;
          if (amountStr.length >= 10) return;
          amountStr += k;
        }
      }
      updateAmountDisplay();
    });
  });

  document.getElementById("prevMonth").addEventListener("click", () => { shiftMonth(-1); });
  document.getElementById("nextMonth").addEventListener("click", () => { shiftMonth(1); });
  document.getElementById("prevMonthStats").addEventListener("click", () => { shiftMonth(-1); });
  document.getElementById("nextMonthStats").addEventListener("click", () => { shiftMonth(1); });
  document.getElementById("prevMonthBudget").addEventListener("click", () => { shiftMonth(-1); });
  document.getElementById("nextMonthBudget").addEventListener("click", () => { shiftMonth(1); });
  function shiftMonth(delta) {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1);
    renderAll();
    if (currentView === "stats") renderStats();
    buildBudgetList();
  }

  document.querySelectorAll(".toggle-btn").forEach((b) => {
    b.addEventListener("click", () => {
      statsType = b.dataset.stype;
      document.querySelectorAll(".toggle-btn").forEach((x) => x.classList.toggle("active", x === b));
      renderStats();
    });
  });

  // Settings
  const currencySelect = document.getElementById("currencySelect");
  currencySelect.value = currency;
  currencySelect.addEventListener("change", () => {
    currency = currencySelect.value;
    localStorage.setItem(CURRENCY_KEY, currency);
    renderAll();
    buildBudgetList();
  });

  document.getElementById("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(transactions, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `canjar-export-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  document.getElementById("importInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error("bad format");
        transactions = data;
        saveTx(transactions);
        renderAll();
        toast("匯入成功");
      } catch (err) {
        toast("檔案格式錯誤");
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  });

  document.getElementById("clearBtn").addEventListener("click", () => {
    if (confirm("確定要清除所有記帳資料嗎？此動作無法復原。")) {
      transactions = [];
      saveTx(transactions);
      renderAll();
      toast("已清除所有資料");
    }
  });

  // ---------- Init ----------
  buildBudgetList();
  showView("home");

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
