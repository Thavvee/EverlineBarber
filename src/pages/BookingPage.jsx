import { useEffect, useMemo, useState } from "react";

const dayLabels = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function getCurrentWeekDays() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    const dayOfWeek = date.getDay();

    return {
      label: dayLabels[dayOfWeek],
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

function BookingPage() {
  const weekDays = useMemo(getCurrentWeekDays, []);
  const timeSlots = useMemo(createTimeSlots, []);
  const [selectedDate, setSelectedDate] = useState(weekDays[0].dateKey);
  const [selectedTime, setSelectedTime] = useState(timeSlots[0]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [serviceType, setServiceType] = useState("ตัดผม");
  const [notes, setNotes] = useState("");
  const [availableTimes, setAvailableTimes] = useState(new Set());
  const [availableDates, setAvailableDates] = useState(new Set());
  const selectedDay = weekDays.find((day) => day.dateKey === selectedDate) || weekDays[0];

  useEffect(() => {
    async function checkAllWeekWorktime() {
      const available = new Set();
      
      for (const day of weekDays) {
        try {
          const response = await fetch(`/api/worktime/dates/${day.dateKey}`);
          if (!response.ok) continue;
          const worktime = await response.json();
          
          // Check if this date has any barber working
          const hasWork = Object.values(worktime).some(barber => barber.work?.length > 0);
          if (hasWork) {
            available.add(day.dateKey);
          }
        } catch (error) {
          console.error(`Error checking worktime for ${day.dateKey}:`, error);
        }
      }
      
      setAvailableDates(available);
    }
    
    checkAllWeekWorktime();
  }, [weekDays]);

  useEffect(() => {
    async function checkWorktime() {
      try {
        const response = await fetch(`/api/worktime/dates/${selectedDate}`);
        if (!response.ok) throw new Error("Failed to load worktime");
        const worktime = await response.json();

        const availableTimeSet = new Set();
        for (const barber of Object.values(worktime)) {
          const workTimes = barber.work || [];
          for (const time of workTimes) {
            availableTimeSet.add(time);
          }
        }
        

        setAvailableTimes(availableTimeSet);
      } catch (error) {
        console.error("Error checking worktime:", error);
        setAvailableTimes(new Set());
      }
    }

    checkWorktime();
  }, [selectedDate, timeSlots]);

  useEffect(() => {
    // If selected date has no available times, switch to first available date
    if (availableDates.size > 0 && !availableDates.has(selectedDate)) {
      const firstAvailableDate = Array.from(availableDates)[0];
      setSelectedDate(firstAvailableDate);
    }
  }, [availableDates, selectedDate]);

  useEffect(() => {
    // If selected time is not available, switch to first available time
    if (availableTimes.size > 0 && !availableTimes.has(selectedTime)) {
      const firstAvailableTime = Array.from(availableTimes)[0];
      setSelectedTime(firstAvailableTime);
    }
  }, [availableTimes, selectedTime]);
  

  function isTimeAvailable(time) {
    return availableTimes.has(time);
  }

  function isDateAvailable(dateKey) {
    return availableDates.has(dateKey);
  }

  function openBookingModal() {
    if (!isTimeAvailable(selectedTime)) {
      window.alert("ช่วงเวลานี้ไม่มีช่างทำงาน");
      return;
    }
    setIsModalOpen(true);
  }

  function closeBookingModal() {
    setIsModalOpen(false);
  }

  function handleConfirmBooking(event) {
    event.preventDefault();

    const bookingDate = new Intl.DateTimeFormat("th-TH", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(selectedDay.date);

    window.alert(
      `จองคิวเรียบร้อย\n\nชื่อ: ${customerName || "-"}\nเบอร์ติดต่อ: ${customerPhone || "-"}\nบริการ: ${serviceType}\nวันที่: ${bookingDate}\nเวลา: ${selectedTime}\nหมายเหตุ: ${notes || "-"}`,
    );

    setCustomerName("");
    setCustomerPhone("");
    setServiceType("ตัดผม");
    setNotes("");
    closeBookingModal();
  }

  return (
    <main className="booking-shell">
      <section className="booking-hero">
        <p className="eyebrow">Everline Barber</p>
        <h1>ผมดีอารมณ์ดี</h1>
        <p className="description">เลือกวันและเวลาที่สะดวกสำหรับเข้ารับบริการที่ร้าน</p>
      </section>

      <section className="booking-section" aria-labelledby="date-title">
        <div className="section-head">
          <h2 id="date-title">{formatThaiMonth(selectedDay.date)}</h2>
          <p>สัปดาห์ปัจจุบัน</p>
        </div>

        <div className="date-grid" role="list" aria-label="เลือกวันจองคิว">
          {weekDays.map((day) => (
            <button
              className={`date-option ${selectedDate === day.dateKey ? "selected" : ""} ${
                !isDateAvailable(day.dateKey) ? "unavailable" : ""
              }`}
              key={day.dateKey}
              type="button"
              onClick={() => isDateAvailable(day.dateKey) && setSelectedDate(day.dateKey)}
              disabled={!isDateAvailable(day.dateKey)}
              title={!isDateAvailable(day.dateKey) ? "ไม่มีช่างทำงาน" : ""}
            >
              <span>{day.label}</span>
              <strong>{day.dayNumber}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="booking-section" aria-labelledby="time-title">
        <div className="section-head">
          <h2 id="time-title">เลือกเวลา</h2>
          <p>รอบละ 40 นาที</p>
        </div>

        <div className="time-grid" role="list" aria-label="เลือกเวลาจองคิว">
          {timeSlots.map((time) => (
            <button
              className={`time-option ${selectedTime === time ? "selected" : ""} ${
                !isTimeAvailable(time) ? "unavailable" : ""
              }`}
              key={time}
              type="button"
              onClick={() => isTimeAvailable(time) && setSelectedTime(time)}
              disabled={!isTimeAvailable(time)}
              title={!isTimeAvailable(time) ? "ไม่มีช่างทำงาน" : ""}
            >
              {time}
            </button>
          ))}
        </div>
      </section>

      <button className="book-button" type="button" onClick={openBookingModal}>
        จองคิว
      </button>

      {isModalOpen ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-modal-title"
        >
          <div className="modal-panel">
            <div className="modal-header">
              <div>
                <p className="eyebrow">ยืนยันจองคิว</p>
                <h2 id="booking-modal-title">กรอกรายละเอียดเพิ่มเติม</h2>
              </div>
              <button
                className="modal-close"
                type="button"
                onClick={closeBookingModal}
                aria-label="ปิด"
              >
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={handleConfirmBooking}>
              <div className="field-group">
                <label htmlFor="customer-name">ชื่อ-นามสกุล</label>
                <input
                  id="customer-name"
                  type="text"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="กรอกชื่อของคุณ"
                  required
                />
              </div>

              <div className="field-group">
                <label htmlFor="customer-phone">เบอร์ติดต่อ</label>
                <input
                  id="customer-phone"
                  type="tel"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  placeholder="091-234-5678"
                  required
                />
              </div>

              <div className="field-group">
                <label htmlFor="service-type">บริการ</label>
                <select
                  id="service-type"
                  value={serviceType}
                  onChange={(event) => setServiceType(event.target.value)}
                >
                  <option value="ตัดผม">ตัดผม</option>
                  <option value="ตัดผม + โกนหนวด">ตัดผม + โกนหนวด</option>
                  <option value="โกนหนวด">โกนหนวด</option>
                </select>
              </div>

              <div className="field-group">
                <label htmlFor="booking-notes">หมายเหตุ</label>
                <textarea
                  id="booking-notes"
                  rows="4"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="เช่น ต้องการช่างคนใด หรือมีเงื่อนไขพิเศษ"
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="modal-cancel" onClick={closeBookingModal}>
                  ยกเลิก
                </button>
                <button type="submit" className="modal-submit">
                  ยืนยันจองคิว
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default BookingPage;
