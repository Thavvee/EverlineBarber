const sampleRows = [
  ["2026-04-23", "ตัดผมชาย", 300, "เงินสด", "ช่างแบงค์", "ลูกค้าประจำ"],
  ["2026-04-23", "โกนหนวด", 150, "โอนเงิน", "ช่างอาร์ต", ""],
  ["2026-04-24", "ตัด+สระ", 450, "โอนเงิน", "ช่างแบงค์", ""],
  ["2026-04-24", "แว็กซ์ผม", -320, "เงินสด", "ร้าน", "ซื้อสินค้า"],
  ["2026-04-25", "ย้อมผม", 1200, "โอนเงิน", "ช่างนัท", "โปรสีเข้ม"],
  ["2026-04-26", "ตัดผมเด็ก", 250, "เงินสด", "ช่างอาร์ต", ""],
  ["2026-04-27", "ทรีตเมนต์", 700, "โอนเงิน", "ช่างนัท", ""],
  ["2026-04-28", "ตัดผมชาย", 300, "เงินสด", "ช่างแบงค์", ""],
  ["2026-04-29", "ตัด+โกน", 420, "โอนเงิน", "ช่างอาร์ต", ""],
  ["2026-04-29", "ค่าอุปกรณ์", -850, "โอนเงิน", "ร้าน", "รายจ่ายร้าน"],
].map(([date, item, price, payment, barber, note]) => ({
  date,
  item,
  price: Number(price),
  payment,
  barber,
  note,
}));

const defaultSheetUrl =
  "https://docs.google.com/spreadsheets/d/1setAb6jom6c8K7ydKDvVgrvPq73_0ZXkkI6gtasZNbI/edit?gid=0#gid=0";

const state = {
  rows: sampleRows,
  chart: null,
  pollTimer: null,
};

const els = {
  period: document.querySelector("#periodFilter"),
  periodValue: document.querySelector("#periodValue"),
  periodValueLabel: document.querySelector("#periodValueLabel"),
  barber: document.querySelector("#barberFilter"),
  totalIncome: document.querySelector("#totalIncome"),
  totalExpense: document.querySelector("#totalExpense"),
  netIncome: document.querySelector("#netIncome"),
  totalRows: document.querySelector("#totalRows"),
  rangeLabel: document.querySelector("#rangeLabel"),
  paymentList: document.querySelector("#paymentList"),
  barberSalaryList: document.querySelector("#barberSalaryList"),
  rowsTable: document.querySelector("#rowsTable"),
  syncDot: document.querySelector("#syncDot"),
  syncStatus: document.querySelector("#syncStatus"),
};

const money = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

function startOfWeek(date) {
  const copy = new Date(date);
  const day = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfWeek(date) {
  const copy = startOfWeek(date);
  copy.setDate(copy.getDate() + 6);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function getRange() {
  if (els.period.value === "week") {
    const selected = dateFromWeekValue(els.periodValue.value || weekValue(new Date()));
    return [startOfWeek(selected), endOfWeek(selected)];
  }

  if (els.period.value === "month") {
    const [year, month] = (els.periodValue.value || monthValue(new Date())).split("-").map(Number);
    return [
      new Date(year, month - 1, 1),
      new Date(year, month, 0, 23, 59, 59, 999),
    ];
  }

  const selected = new Date(`${els.periodValue.value || todayLocal()}T00:00:00`);
  const start = new Date(selected);
  const end = new Date(selected);
  end.setHours(23, 59, 59, 999);
  return [start, end];
}

function total(row) {
  return row.price;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function filteredRows() {
  const [start, end] = getRange();
  return state.rows.filter((row) => {
    const rowDate = new Date(`${row.date}T12:00:00`);
    const inDate = rowDate >= start && rowDate <= end;
    const inBarber = els.barber.value === "all" || row.barber === els.barber.value;
    return inDate && inBarber;
  });
}

function updateBarberOptions() {
  const current = els.barber.value;
  const barbers = [...new Set(state.rows.map((row) => row.barber))].sort((a, b) =>
    a.localeCompare(b, "th"),
  );
  els.barber.innerHTML = '<option value="all">ทุกคน</option>';
  for (const barber of barbers) {
    const option = document.createElement("option");
    option.value = barber;
    option.textContent = barber;
    els.barber.appendChild(option);
  }
  els.barber.value = barbers.includes(current) ? current : "all";
}

function renderMetrics(rows) {
  const income = rows.filter((row) => total(row) >= 0).reduce((sum, row) => sum + total(row), 0);
  const expense = Math.abs(
    rows.filter((row) => total(row) < 0).reduce((sum, row) => sum + total(row), 0),
  );

  els.totalIncome.textContent = money.format(income);
  els.totalExpense.textContent = money.format(expense);
  els.netIncome.textContent = money.format(income - expense);
  els.totalRows.textContent = rows.length.toLocaleString("th-TH");
}

function renderChart(rows) {
  const grouped = rows.reduce((acc, row) => {
    acc[row.barber] = (acc[row.barber] || 0) + total(row);
    return acc;
  }, {});
  const labels = Object.keys(grouped);
  const values = Object.values(grouped);

  if (state.chart) state.chart.destroy();
  state.chart = new Chart(document.querySelector("#barberChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "ยอดสุทธิ",
          data: values,
          backgroundColor: ["#1f7a4d", "#2f6f9f", "#c58b2b", "#b4493f", "#6b5b95"],
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          ticks: {
            callback: (value) => money.format(value),
          },
        },
      },
    },
  });
}

function renderPayments(rows) {
  const grouped = rows.reduce((acc, row) => {
    const value = Math.max(total(row), 0);
    acc[row.payment] = (acc[row.payment] || 0) + value;
    return acc;
  }, {});
  const max = Math.max(...Object.values(grouped), 1);

  const entries = Object.entries(grouped);
  if (!entries.length) {
    els.paymentList.innerHTML = '<p>ไม่มีข้อมูลในช่วงเวลานี้</p>';
    return;
  }

  els.paymentList.innerHTML = entries
    .map(
      ([name, value]) => `
        <div class="payment-row">
          <header><span>${escapeHtml(name || "-")}</span><span>${money.format(value)}</span></header>
          <div class="track"><div class="fill" style="width:${(value / max) * 100}%"></div></div>
        </div>
      `,
    )
    .join("");
}

function renderBarberSalaries(rows) {
  const grouped = rows.reduce((acc, row) => {
    const name = row.barber || "-";
    const value = Math.max(total(row), 0);
    if (!value || name === "ร้าน" || name === "-") return acc;
    acc[name] = (acc[name] || 0) + value;
    return acc;
  }, {});

  const entries = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    els.barberSalaryList.innerHTML = '<p>ไม่มีรายรับของช่างในช่วงเวลานี้</p>';
    return;
  }

  const max = Math.max(...entries.map(([, value]) => value), 1);
  els.barberSalaryList.innerHTML = entries
    .map(
      ([name, value]) => `
        <div class="salary-row">
          <header>
            ${renderBadge(name, "barber")}
            <strong>${money.format(value)}</strong>
          </header>
          <div class="track"><div class="fill salary-fill" style="width:${(value / max) * 100}%"></div></div>
        </div>
      `,
    )
    .join("");
}

function renderTable(rows) {
  if (!rows.length) {
    els.rowsTable.innerHTML = '<tr><td colspan="6">ไม่มีข้อมูลในช่วงเวลานี้</td></tr>';
    return;
  }

  els.rowsTable.innerHTML = rows
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.date)}</td>
          <td>${escapeHtml(row.item)}</td>
          <td class="money ${row.price < 0 ? "negative" : "positive"}">${money.format(row.price)}</td>
          <td>${renderBadge(row.payment, "payment")}</td>
          <td>${renderBadge(row.barber, "barber")}</td>
          <td>${escapeHtml(row.note || "-")}</td>
        </tr>
      `,
    )
    .join("");
}

function render() {
  updateBarberOptions();
  const rows = filteredRows();
  const [start, end] = getRange();
  els.rangeLabel.textContent = `${formatDate(start)} - ${formatDate(end)}`;
  renderMetrics(rows);
  renderChart(rows);
  renderPayments(rows);
  renderBarberSalaries(rows);
  renderTable(rows);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderBadge(value, type) {
  const text = value || "-";
  return `<span class="badge ${type} ${badgeTone(text)}">${escapeHtml(text)}</span>`;
}

function badgeTone(value) {
  const normalized = String(value).toLowerCase();
  if (normalized.includes("โอน") || normalized.includes("transfer")) return "blue";
  if (normalized.includes("สด") || normalized.includes("cash")) return "green";
  if (normalized.includes("ร้าน") || normalized.includes("expense")) return "red";
  return "gold";
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const rows = lines.map((line) => {
    const cells = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"' && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) {
        cells.push(cell.trim());
        cell = "";
      } else cell += char;
    }
    cells.push(cell.trim());
    return cells;
  });

  return rows.slice(1).map((row) => ({
    date: normalizeDate(row[0]),
    item: row[1] || "-",
    price: Number(String(row[2] || "0").replace(/,/g, "")),
    payment: row[3] || "-",
    barber: row[4] || "-",
    note: row[5] || "",
  }));
}

function toGoogleSheetCsvUrl(url) {
  const trimmed = url.trim();
  const match = trimmed.match(/docs\.google\.com\/spreadsheets\/d\/([^/]+)/);
  if (!match) return trimmed;

  const sheetUrl = new URL(trimmed);
  const gid = sheetUrl.searchParams.get("gid") || sheetUrl.hash.match(/gid=(\d+)/)?.[1] || "0";
  return `https://docs.google.com/spreadsheets/d/${match[1]}/gviz/tq?tqx=out:csv&gid=${gid}`;
}

function normalizeDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parts = String(value).split(/[/-]/).map((part) => part.padStart(2, "0"));
  if (parts.length === 3) {
    if (parts[0].length === 4) return `${parts[0]}-${parts[1]}-${parts[2]}`;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return new Date().toISOString().slice(0, 10);
}

async function loadSheet() {
  const url = defaultSheetUrl;
  if (!url) return;
  els.syncStatus.textContent = "กำลังโหลดข้อมูล";
  const response = await fetch(toGoogleSheetCsvUrl(url), { cache: "no-store" });
  if (!response.ok) throw new Error("โหลด Google Sheets CSV ไม่สำเร็จ");
  state.rows = parseCsv(await response.text());
  els.syncDot.classList.add("live");
  els.syncStatus.textContent = `อัปเดตล่าสุด ${new Date().toLocaleTimeString("th-TH")}`;
  render();
}

function startPolling() {
  clearInterval(state.pollTimer);
  state.pollTimer = setInterval(() => {
    loadSheet().catch(showError);
  }, 30000);
}

function showError(error) {
  els.syncDot.classList.remove("live");
  els.syncStatus.textContent = error.message;
}

function todayLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function weekValue(date) {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((copy - yearStart) / 86400000 + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function dateFromWeekValue(value) {
  const match = value.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return new Date(`${todayLocal()}T00:00:00`);
  const year = Number(match[1]);
  const week = Number(match[2]);
  const fourthOfJanuary = new Date(year, 0, 4);
  const firstWeekStart = startOfWeek(fourthOfJanuary);
  firstWeekStart.setDate(firstWeekStart.getDate() + (week - 1) * 7);
  return firstWeekStart;
}

function updatePeriodControl() {
  const now = new Date();
  if (els.period.value === "week") {
    els.periodValueLabel.textContent = "เลือกสัปดาห์";
    els.periodValue.type = "week";
    els.periodValue.value = weekValue(now);
    return;
  }

  if (els.period.value === "month") {
    els.periodValueLabel.textContent = "เลือกเดือน";
    els.periodValue.type = "month";
    els.periodValue.value = monthValue(now);
    return;
  }

  els.periodValueLabel.textContent = "เลือกวันที่";
  els.periodValue.type = "date";
  els.periodValue.value = todayLocal();
}

els.period.addEventListener("change", () => {
  updatePeriodControl();
  render();
});
els.periodValue.addEventListener("change", render);
els.barber.addEventListener("change", render);

updatePeriodControl();
render();
loadSheet().then(startPolling).catch(showError);
