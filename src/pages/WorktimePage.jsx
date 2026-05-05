import { useMemo, useState } from "react";

const dayLabels = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function getCurrentWeekDays() {
  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  sunday.setHours(0, 0, 0, 0);

  return dayLabels.map((label, index) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + index);

    return {
      label,
      date,
      dateKey: date.toISOString().slice(0, 10),
      dayNumber: date.getDate(),
    };
  });
}

function createTimeSlots() {
  const slots = [];
  const start = 10 * 60;
  const end = 19 * 60 + 20;

  for (let minute = start; minute <= end; minute += 40) {
    const hourText = String(Math.floor(minute / 60)).padStart(2, "0");
    const minuteText = String(minute % 60).padStart(2, "0");
    slots.push(`${hourText}:${minuteText}`);
  }

  return slots;
}

function formatThaiMonth(date) {
  return new Intl.DateTimeFormat("th-TH", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function WorktimePage() {
  const weekDays = useMemo(getCurrentWeekDays, []);
  const timeSlots = useMemo(createTimeSlots, []);
  const [selectedDates, setSelectedDates] = useState([weekDays[0].dateKey]);
  const [selectedTimes, setSelectedTimes] = useState(new Set());
  const [isFullDay, setIsFullDay] = useState(false);
  const [workType, setWorkType] = useState("work");

  function toggleDateSelection(dateKey) {
    setSelectedDates((current) => {
      if (current.includes(dateKey)) {
        return current.filter((d) => d !== dateKey);
      }
      if (current.length < 7) {
        return [...current, dateKey];
      }
      return current;
    });
  }

  function toggleTimeSelection(time) {
    setSelectedTimes((current) => {
      const next = new Set(current);
      if (next.has(time)) {
        next.delete(time);
      } else {
        next.add(time);
      }
      return next;
    });
  }

  function selectAllTimes() {
    setSelectedTimes(new Set(timeSlots));
  }

  function clearAllTimes() {
    setSelectedTimes(new Set());
  }

  async function handleSubmit() {
    if (selectedDates.length === 0) {
      window.alert("กรุณาเลือกวันทำงาน");
      return;
    }

    if (!isFullDay && selectedTimes.size === 0) {
      window.alert("กรุณาเลือกเวลาทำงาน");
      return;
    }

    const times = isFullDay ? timeSlots : Array.from(selectedTimes);

    try {
      const response = await fetch("/api/worktime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dates: selectedDates,
          times,
          type: workType,
        }),
      });

      if (!response.ok) throw new Error("ไม่สามารถบันทึกเวลาทำงาน");

      const workTypeText =
        workType === "work" ? "บันทึกเวลาทำงาน" : "บันทึกวันลา";
      window.alert(
        `${workTypeText}สำเร็จ (${selectedDates.length} วัน, ${times.length} ช่วงเวลา)`,
      );

      setSelectedDates([weekDays[0].dateKey]);
      setSelectedTimes(new Set());
      setIsFullDay(false);
      setWorkType("work");
    } catch (error) {
      window.alert(`เกิดข้อผิดพลาด: ${error.message}`);
    }
  }

  const firstDay = weekDays.find((d) => selectedDates.includes(d.dateKey)) ||
    weekDays[0];

  return (
    <main className="booking-shell">
      <section className="booking-hero">
        <p className="eyebrow">Everline Barber</p>
        <h1>บันทึกเวลาทำงาน</h1>
        <p className="description">เลือกวัน เวลา และประเภทการลงเวลา</p>
      </section>

      <section className="booking-section" aria-labelledby="date-title">
        <div className="section-head">
          <h2 id="date-title">{formatThaiMonth(firstDay.date)}</h2>
          <p>เลือกได้สูงสุด 7 วัน ({selectedDates.length}/7)</p>
        </div>

        <div className="date-grid" role="list" aria-label="เลือกวันทำงาน">
          {weekDays.map((day) => (
            <button
              className={`date-option ${
                selectedDates.includes(day.dateKey) ? "selected" : ""
              }`}
              key={day.dateKey}
              type="button"
              onClick={() => toggleDateSelection(day.dateKey)}
            >
              <span>{day.label}</span>
              <strong>{day.dayNumber}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="booking-section" aria-labelledby="type-title">
        <div className="section-head">
          <h2 id="type-title">ประเภท</h2>
        </div>

        <div className="type-radio-group">
          <label className="radio-label">
            <input
              type="radio"
              name="work-type"
              value="work"
              checked={workType === "work"}
              onChange={(e) => setWorkType(e.target.value)}
            />
            ทำงาน
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="work-type"
              value="leave"
              checked={workType === "leave"}
              onChange={(e) => setWorkType(e.target.value)}
            />
            ลา
          </label>
        </div>
      </section>

      {workType === "work" && (
        <section className="booking-section" aria-labelledby="time-title">
          <div className="section-head">
            <h2 id="time-title">เวลาทำงาน</h2>
            <p>รอบละ 40 นาที</p>
          </div>

          <div className="time-controls">
            <button
              className="time-control-btn"
              type="button"
              onClick={selectAllTimes}
            >
              เลือกทั้งวัน
            </button>
            <button
              className="time-control-btn"
              type="button"
              onClick={clearAllTimes}
            >
              ยกเลิก
            </button>
          </div>

          <div className="time-grid" role="list" aria-label="เลือกเวลาทำงาน">
            {timeSlots.map((time) => (
              <button
                className={`time-option ${
                  selectedTimes.has(time) ? "selected" : ""
                }`}
                key={time}
                type="button"
                onClick={() => toggleTimeSelection(time)}
              >
                {time}
              </button>
            ))}
          </div>
        </section>
      )}

      <button className="book-button" type="button" onClick={handleSubmit}>
        บันทึก
      </button>
    </main>
  );
}

export default WorktimePage;
