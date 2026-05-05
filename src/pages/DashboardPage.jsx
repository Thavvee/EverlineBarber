import { useEffect, useMemo, useRef, useState } from "react";
import Chart from "chart.js/auto";

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

const datasourceName = "Everline Barber SQL Database";
const datasourceUrl = "/api/transactions";

const money = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

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

function normalizeDate(value) {
  if (!value) return todayLocal();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parts = String(value).split(/[/-]/).map((part) => part.padStart(2, "0"));
  if (parts.length === 3) {
    if (parts[0].length === 4) return `${parts[0]}-${parts[1]}-${parts[2]}`;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return new Date().toISOString().slice(0, 10);
}

function normalizeTransaction(row) {
  return {
    date: normalizeDate(row.date),
    item: row.item || "-",
    price: Number(row.price || 0),
    payment: row.payment || "-",
    barber: row.barber || "-",
    note: row.note || "",
  };
}

function formatDate(date) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function badgeTone(value) {
  const normalized = String(value).toLowerCase();
  if (normalized.includes("โอน") || normalized.includes("transfer")) return "blue";
  if (normalized.includes("สด") || normalized.includes("cash")) return "green";
  if (normalized.includes("ร้าน") || normalized.includes("expense")) return "red";
  return "gold";
}

function Badge({ value, type }) {
  const text = value || "-";
  return <span className={`badge ${type} ${badgeTone(text)}`}>{text}</span>;
}

function getPeriodValue(period) {
  const now = new Date();
  if (period === "week") return weekValue(now);
  if (period === "month") return monthValue(now);
  return todayLocal();
}

function getRange(period, periodValue) {
  if (period === "week") {
    const selected = dateFromWeekValue(periodValue || weekValue(new Date()));
    return [startOfWeek(selected), endOfWeek(selected)];
  }

  if (period === "month") {
    const [year, month] = (periodValue || monthValue(new Date())).split("-").map(Number);
    return [new Date(year, month - 1, 1), new Date(year, month, 0, 23, 59, 59, 999)];
  }

  const selected = new Date(`${periodValue || todayLocal()}T00:00:00`);
  const start = new Date(selected);
  const end = new Date(selected);
  end.setHours(23, 59, 59, 999);
  return [start, end];
}

function DashboardPage() {
  const [rows, setRows] = useState(sampleRows);
  const [period, setPeriod] = useState("month");
  const [periodValue, setPeriodValue] = useState(getPeriodValue("month"));
  const [barber, setBarber] = useState("all");
  const [syncStatus, setSyncStatus] = useState("กำลังเชื่อมต่อ SQL");
  const [syncLive, setSyncLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  const range = useMemo(() => getRange(period, periodValue), [period, periodValue]);

  const barbers = useMemo(
    () => [...new Set(rows.map((row) => row.barber))].sort((a, b) => a.localeCompare(b, "th")),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const [start, end] = range;
    return rows.filter((row) => {
      const rowDate = new Date(`${row.date}T12:00:00`);
      return rowDate >= start && rowDate <= end && (barber === "all" || row.barber === barber);
    });
  }, [barber, range, rows]);

  const metrics = useMemo(() => {
    const income = filteredRows
      .filter((row) => row.price >= 0)
      .reduce((sum, row) => sum + row.price, 0);
    const expense = Math.abs(
      filteredRows.filter((row) => row.price < 0).reduce((sum, row) => sum + row.price, 0),
    );
    return { income, expense, net: income - expense, count: filteredRows.length };
  }, [filteredRows]);

  const payments = useMemo(() => {
    const grouped = filteredRows.reduce((acc, row) => {
      const value = Math.max(row.price, 0);
      acc[row.payment] = (acc[row.payment] || 0) + value;
      return acc;
    }, {});
    return Object.entries(grouped);
  }, [filteredRows]);

  const salaries = useMemo(() => {
    const grouped = filteredRows.reduce((acc, row) => {
      const name = row.barber || "-";
      const value = Math.max(row.price, 0);
      if (!value || name === "ร้าน" || name === "-") return acc;
      acc[name] = (acc[name] || 0) + value;
      return acc;
    }, {});
    return Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  }, [filteredRows]);

  async function loadData() {
    setLoading(true);
    setSyncStatus("กำลังโหลดข้อมูล");
    try {
      const response = await fetch(datasourceUrl, { cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) throw new Error("โหลดข้อมูลจาก SQL ไม่สำเร็จ");
      const nextRows = await response.json();
      setRows(nextRows.map(normalizeTransaction));
      setSyncLive(true);
      setSyncStatus(`อัปเดตล่าสุด ${new Date().toLocaleTimeString("th-TH")}`);
    } catch (error) {
      setSyncLive(false);
      setSyncStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const timer = window.setInterval(loadData, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!barbers.includes(barber)) setBarber("all");
  }, [barber, barbers]);

  useEffect(() => {
    const grouped = filteredRows.reduce((acc, row) => {
      acc[row.barber] = (acc[row.barber] || 0) + row.price;
      return acc;
    }, {});

    if (chartInstanceRef.current) chartInstanceRef.current.destroy();
    chartInstanceRef.current = new Chart(chartRef.current, {
      type: "bar",
      data: {
        labels: Object.keys(grouped),
        datasets: [
          {
            label: "ยอดสุทธิ",
            data: Object.values(grouped),
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

    return () => {
      if (chartInstanceRef.current) chartInstanceRef.current.destroy();
    };
  }, [filteredRows]);

  function handlePeriodChange(event) {
    const nextPeriod = event.target.value;
    setPeriod(nextPeriod);
    setPeriodValue(getPeriodValue(nextPeriod));
  }

  const [start, end] = range;
  const paymentMax = Math.max(...payments.map(([, value]) => value), 1);
  const salaryMax = Math.max(...salaries.map(([, value]) => value), 1);
  const periodValueLabel =
    period === "week" ? "เลือกสัปดาห์" : period === "month" ? "เลือกเดือน" : "เลือกวันที่";
  const periodValueType = period === "week" ? "week" : period === "month" ? "month" : "date";

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Everline Barber</p>
          <h1>Dashboard รายรับรายจ่าย</h1>
        </div>
        <div className="status-card">
          <span className={`status-dot ${syncLive ? "live" : ""}`} />
          <span>{syncStatus}</span>
        </div>
      </section>

      <section className="controls" aria-label="ตัวกรองข้อมูล">
        <label>
          ช่วงเวลา
          <select value={period} onChange={handlePeriodChange}>
            <option value="day">รายวัน</option>
            <option value="week">รายสัปดาห์</option>
            <option value="month">รายเดือน</option>
          </select>
        </label>
        <label>
          <span>{periodValueLabel}</span>
          <input type={periodValueType} value={periodValue} onChange={(event) => setPeriodValue(event.target.value)} />
        </label>
        <label>
          ช่าง
          <select value={barber} onChange={(event) => setBarber(event.target.value)}>
            <option value="all">ทุกคน</option>
            {barbers.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <div className="datasource-control" aria-label="แหล่งข้อมูล">
          <span>Datasource</span>
          <div className="datasource-row">
            <strong>{datasourceName}</strong>
            <button type="button" onClick={loadData} disabled={loading}>
              Fetch ข้อมูล
            </button>
          </div>
        </div>
      </section>

      <section className="metric-grid" aria-label="สรุปภาพรวม">
        <article className="metric income">
          <span>รายรับรวม</span>
          <strong>{money.format(metrics.income)}</strong>
        </article>
        <article className="metric expense">
          <span>รายจ่ายรวม</span>
          <strong>{money.format(metrics.expense)}</strong>
        </article>
        <article className="metric net">
          <span>สุทธิ</span>
          <strong>{money.format(metrics.net)}</strong>
        </article>
        <article className="metric">
          <span>จำนวนรายการ</span>
          <strong>{metrics.count.toLocaleString("th-TH")}</strong>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel chart-panel">
          <div className="panel-head">
            <div>
              <h2>ยอดต่อช่าง</h2>
              <p>{`${formatDate(start)} - ${formatDate(end)}`}</p>
            </div>
          </div>
          <canvas ref={chartRef} height="135" />
        </article>

        <article className="panel">
          <div className="panel-head">
            <div>
              <h2>ช่องทางรับเงิน</h2>
              <p>โอนเงินและเงินสด</p>
            </div>
          </div>
          <div className="payment-list">
            {payments.length ? (
              payments.map(([name, value]) => (
                <div className="payment-row" key={name}>
                  <header>
                    <span>{name || "-"}</span>
                    <span>{money.format(value)}</span>
                  </header>
                  <div className="track">
                    <div className="fill" style={{ width: `${(value / paymentMax) * 100}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <p>ไม่มีข้อมูลในช่วงเวลานี้</p>
            )}
          </div>
        </article>

        <article className="panel salary-panel">
          <div className="panel-head">
            <div>
              <h2>เงินเดือนช่าง</h2>
              <p>ยอดรายรับตามช่วงเวลาที่เลือก</p>
            </div>
          </div>
          <div className="salary-list">
            {salaries.length ? (
              salaries.map(([name, value]) => (
                <div className="salary-row" key={name}>
                  <header>
                    <Badge value={name} type="barber" />
                    <strong>{money.format(value)}</strong>
                  </header>
                  <div className="track">
                    <div className="fill salary-fill" style={{ width: `${(value / salaryMax) * 100}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <p>ไม่มีรายรับของช่างในช่วงเวลานี้</p>
            )}
          </div>
        </article>
      </section>

      <section className="panel table-panel">
        <div className="panel-head">
          <div>
            <h2>รายการล่าสุด</h2>
            <p>คอลัมน์: วันที่, รายการ, ราคา, โอนเงิน/เงินสด, ช่าง, หมายเหตุ</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>วันที่</th>
                <th>รายการ</th>
                <th>ราคา</th>
                <th>ช่องทาง</th>
                <th>ช่าง</th>
                <th>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length ? (
                filteredRows
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((row, index) => (
                    <tr key={`${row.date}-${row.item}-${index}`}>
                      <td>{row.date}</td>
                      <td>{row.item}</td>
                      <td className={`money ${row.price < 0 ? "negative" : "positive"}`}>{money.format(row.price)}</td>
                      <td>
                        <Badge value={row.payment} type="payment" />
                      </td>
                      <td>
                        <Badge value={row.barber} type="barber" />
                      </td>
                      <td>{row.note || "-"}</td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td colSpan="6">ไม่มีข้อมูลในช่วงเวลานี้</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default DashboardPage;
