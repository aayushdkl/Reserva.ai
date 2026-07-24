import React, { useState, useEffect, useMemo, useCallback } from "react"
import "./App.css"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
} from "recharts"

const API_BASE = import.meta.env?.VITE_API_BASE || "http://localhost:5000"

const SERVICES = [
  "Classic Scissor Cut",
  "Fade (Skin, Drop, Burst)",
  "Buzz Cut",
  "Pixie Cut",
  "Line-Up / Edge-Up",
  "Kids Haircut",
  "Trim / Dusting",
  "Layered Cut",
  "Bob / Lob Cut",
  "Wash, Cut & Blowout",
  "Bangs / Fringe Trim",
  "Basic Beard Trim",
  "Beard Sculpting & Line-Up",
  "Hot Towel Shave",
  "Mustache Trim",
  "Head Shave",
  "Root Touch-Up",
  "All-Over Color",
  "Highlights / Lowlights",
  "Balayage / Ombre",
  "Bleach & Tone",
  "Camo Color (Men)",
  "Hair Spa / Deep Conditioning",
  "Scalp Detox & Massage",
  "Keratin / Smoothening",
  "Perm (Standard/Modern)",
  "Hot Tool Styling",
  "Special Occasion Updo",
  "Hair Straightening / Rebonding",
  "Eyebrow Threading",
  "Nose / Ear Waxing",
  "Express Facial / Clean-up",
  "D-Tan / Blackhead Peel Mask",
]

const SERVICE_PRICE = {
  "Classic Scissor Cut": 500,
  "Fade (Skin, Drop, Burst)": 600,
  "Buzz Cut": 350,
  "Pixie Cut": 800,
  "Line-Up / Edge-Up": 200,
  "Kids Haircut": 350,
  "Trim / Dusting": 600,
  "Layered Cut": 1200,
  "Bob / Lob Cut": 1000,
  "Wash, Cut & Blowout": 1800,
  "Bangs / Fringe Trim": 300,
  "Basic Beard Trim": 250,
  "Beard Sculpting & Line-Up": 400,
  "Hot Towel Shave": 600,
  "Mustache Trim": 150,
  "Head Shave": 600,
  "Root Touch-Up": 1500,
  "All-Over Color": 3500,
  "Highlights / Lowlights": 4500,
  "Balayage / Ombre": 6000,
  "Bleach & Tone": 5000,
  "Camo Color (Men)": 1000,
  "Hair Spa / Deep Conditioning": 1500,
  "Scalp Detox & Massage": 1000,
  "Keratin / Smoothening": 6000,
  "Perm (Standard/Modern)": 3000,
  "Hot Tool Styling": 800,
  "Special Occasion Updo": 2000,
  "Hair Straightening / Rebonding": 5000,
  "Eyebrow Threading": 100,
  "Nose / Ear Waxing": 300,
  "Express Facial / Clean-up": 1200,
  "D-Tan / Blackhead Peel Mask": 600,
}

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
]

// ---------- helpers ----------

function formatPhone(phone) {
  return (phone || "").replace("@c.us", "")
}

function formatDate(dateStr) {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

function formatTime(t) {
  if (!t) return "—"
  const [h, m] = t.split(":").map(Number)
  const period = h >= 12 ? "PM" : "AM"
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`
}

function formatServices(services) {
  if (!services || services.length === 0) return "—"
  return services.join(", ")
}

function isThisWeek(dateStr) {
  const d = new Date(dateStr)
  if (isNaN(d)) return false
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - now.getDay())
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 7)
  return d >= start && d < end
}

function toDateKey(d) {
  return d.toISOString().slice(0, 10)
}

// ---------- data hooks ----------

function useFetchList(path) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}${path}`)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const json = await res.json()
      setData(Array.isArray(json) ? json : json.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [path])

  useEffect(() => {
    reload()
  }, [reload])

  return { data, loading, error, reload }
}

// UPDATE: Added workers to daily_hours, and added negotiation/handoff toggles[cite: 1]
function defaultConfig() {
  return {
    services: SERVICES.map((name) => ({
      name,
      price: SERVICE_PRICE[name] || 0,
      duration_minutes: 30,
      paused: false,
    })),
    daily_hours: DAYS.map((day) => ({
      day,
      closed: day === "Sunday",
      open: "10:00",
      close: "19:00",
      workers: 1, // Determines how many simultaneous bookings are allowed
    })),
    daily_customer_cap: null,
    buffer_minutes: 10,
    manual_override: false,
    approve_before_confirm: false,
    enable_negotiation: false,
    message_handoff_limit: 20, // Handoff to human after this many messages
  }
}

// Merges a config fetched/returned from the server with local defaults.
// IMPORTANT: a freshly-created BusinessConfig document on the server has
// services/daily_hours as *empty arrays* (schema default), not undefined.
// A naive {...defaultConfig(), ...json} spread would let those empty
// arrays silently wipe out the real service/hours lists. So we only take
// the server's value when it actually has entries in it.
function mergeConfig(json) {
  const base = defaultConfig()
  const merged = { ...base, ...json }
  if (!Array.isArray(json?.services) || json.services.length === 0) {
    merged.services = base.services
  }
  if (!Array.isArray(json?.daily_hours) || json.daily_hours.length === 0) {
    merged.daily_hours = base.daily_hours
  }
  return merged
}

function useConfig() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setNotFound(false)
    try {
      const res = await fetch(`${API_BASE}/api/config`)
      if (res.status === 404) {
        setNotFound(true)
        setConfig(defaultConfig())
        return
      }
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const json = await res.json()
      setConfig(mergeConfig(json))
    } catch (err) {
      setError(err.message)
      setConfig(defaultConfig())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const save = useCallback(async (next) => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const json = await res.json()
      setConfig(mergeConfig(json))
      setNotFound(false)
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  return { config, setConfig, loading, saving, error, notFound, save }
}

// ---------- status stamp ----------

function StatusStamp({ status }) {
  const label = (status || "unknown").toUpperCase()
  return <span className={`stamp stamp--${status}`}>{label}</span>
}

// ---------- sidebar ----------

function Sidebar({ active, onSelect, counts }) {
  const items = [
    { key: "overview", label: "Overview", count: null },
    { key: "calendar", label: "Calendar", count: null },
    { key: "bookings", label: "Bookings", count: counts.bookings },
    {
      key: "conversations",
      label: "Conversations",
      count: counts.conversations,
    },
    { key: "analytics", label: "Analytics", count: null },
    { key: "settings", label: "Settings", count: null },
  ]
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__scissors" aria-hidden="true">
          ✂
        </span>
        <div>
          <div className="sidebar__title">Fade &amp; Blade</div>
          <div className="sidebar__subtitle">Front Desk Ledger</div>
        </div>
      </div>
      <nav className="sidebar__nav">
        {items.map((item) => (
          <button
            key={item.key}
            className={`sidebar__link ${active === item.key ? "is-active" : ""}`}
            onClick={() => onSelect(item.key)}
          >
            <span>{item.label}</span>
            {item.count != null && (
              <span className="sidebar__badge">{item.count}</span>
            )}
          </button>
        ))}
      </nav>
      <div className="sidebar__footer">
        <div className="sidebar__hours">Mon–Sat · 10:00–19:00</div>
        <div className="sidebar__hours">Closed Sundays</div>
      </div>
    </aside>
  )
}

// ---------- shared stat card ----------

function Stat({ label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">{value}</div>
      {sub && <div className="stat-card__sub">{sub}</div>}
    </div>
  )
}

function useAnalytics(bookings, events) {
  return useMemo(() => {
    const weekBookings = bookings.filter((b) => isThisWeek(b.date))
    const todayStr = new Date().toISOString().slice(0, 10)
    const todayBookings = bookings.filter((b) => b.date === todayStr)

    const serviceCounts = {}
    weekBookings.forEach((b) => {
      ;(b.services || []).forEach((s) => {
        serviceCounts[s] = (serviceCounts[s] || 0) + 1
      })
    })

    const hourCounts = {}
    bookings.forEach((b) => {
      const h = (b.time || "").split(":")[0]
      if (h) hourCounts[h] = (hourCounts[h] || 0) + 1
    })
    const sortedHours = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])
    const busiestHour = sortedHours[0]
      ? formatTime(`${sortedHours[0][0]}:00`)
      : "—"

    const started = events.filter((e) => e.event_type === "started").length
    const confirmed = events.filter(
      (e) => e.event_type === "booking_confirmed",
    ).length
    const conversion =
      started > 0 ? Math.round((confirmed / started) * 100) : null

    const revenueOf = (b) => (b.payment_status === "paid" ? b.price || 0 : 0)
    const revenueToday = todayBookings.reduce((sum, b) => sum + revenueOf(b), 0)
    const revenueWeek = weekBookings.reduce((sum, b) => sum + revenueOf(b), 0)

    const cancelled = bookings.filter((b) => b.status === "cancelled").length
    const cancelRate =
      bookings.length > 0
        ? Math.round((cancelled / bookings.length) * 100)
        : null

    const byPhone = {}
    bookings.forEach((b) => {
      byPhone[b.customer_phone] = (byPhone[b.customer_phone] || 0) + 1
    })
    const uniquePhones = Object.keys(byPhone).length
    const repeatPhones = Object.values(byPhone).filter((c) => c > 1).length
    const repeatRate =
      uniquePhones > 0 ? Math.round((repeatPhones / uniquePhones) * 100) : null

    const topService =
      Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—"

    return {
      topService,
      serviceCounts,
      hourCounts,
      busiestHour,
      conversion,
      revenueToday,
      revenueWeek,
      cancelRate,
      repeatRate,
      todayCount: todayBookings.length,
      weekCount: weekBookings.length,
      started,
      confirmed,
    }
  }, [bookings, events])
}

// ---------- overview ----------

function Overview({ bookings, events, onNavigate }) {
  const a = useAnalytics(bookings, events)
  const upcoming = useMemo(() => {
    const now = new Date()
    return bookings
      .filter((b) => b.status !== "cancelled")
      .filter((b) => new Date(`${b.date}T${b.time || "00:00"}`) >= now)
      .sort(
        (x, y) =>
          new Date(`${x.date}T${x.time}`) - new Date(`${y.date}T${y.time}`),
      )
      .slice(0, 5)
  }, [bookings])

  return (
    <div>
      <div className="panel-heading">
        <h1>Today's Ledger</h1>
        <p>A running tally, pulled straight from bookings and chat activity.</p>
      </div>
      <div className="stat-grid">
        <Stat
          label="Booked today"
          value={a.todayCount}
          sub={`${a.weekCount} this week`}
        />
        <Stat
          label="Revenue today"
          value={`Rs. ${a.revenueToday}`}
          sub={`Rs. ${a.revenueWeek} this week`}
        />
        <Stat label="Top service (week)" value={a.topService} />
        <Stat label="Busiest hour" value={a.busiestHour} />
      </div>

      <div className="two-col">
        <div className="panel-block">
          <div className="panel-block__head">
            <h2>Next up</h2>
            <button className="link-btn" onClick={() => onNavigate("calendar")}>
              Open calendar →
            </button>
          </div>
          {upcoming.length === 0 && (
            <div className="empty-state">Nothing on the books yet.</div>
          )}
          <div className="agenda-list">
            {upcoming.map((b) => (
              <div className="agenda-row" key={b._id}>
                <div className="agenda-row__time">
                  <div>{formatDate(b.date)}</div>
                  <div className="agenda-row__time-sub">
                    {formatTime(b.time)}
                  </div>
                </div>
                <div className="agenda-row__body">
                  <div className="agenda-row__name">
                    {b.customerName || "Walk-in"}
                  </div>
                  <div className="agenda-row__service">
                    {formatServices(b.services)}
                  </div>
                </div>
                <StatusStamp status={b.status} />
              </div>
            ))}
          </div>
        </div>

        <div className="panel-block">
          <div className="panel-block__head">
            <h2>Snapshot</h2>
            <button
              className="link-btn"
              onClick={() => onNavigate("analytics")}
            >
              Full analytics →
            </button>
          </div>
          <div className="stat-grid stat-grid--tight">
            <Stat
              label="Lead → booking"
              value={a.conversion != null ? `${a.conversion}%` : "—"}
            />
            <Stat
              label="Cancellation rate"
              value={a.cancelRate != null ? `${a.cancelRate}%` : "—"}
            />
            <Stat
              label="Repeat customers"
              value={a.repeatRate != null ? `${a.repeatRate}%` : "—"}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- calendar ----------

function CalendarTab({ bookings }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })
  const [selected, setSelected] = useState(() => toDateKey(new Date()))

  const byDate = useMemo(() => {
    const map = {}
    bookings.forEach((b) => {
      if (!b.date) return
      if (!map[b.date]) map[b.date] = []
      map[b.date].push(b)
    })
    Object.values(map).forEach((list) =>
      list.sort((x, y) => (x.time || "").localeCompare(y.time || "")),
    )
    return map
  }, [bookings])

  const monthLabel = cursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  })

  const cells = useMemo(() => {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const firstDay = new Date(year, month, 1)
    const startOffset = firstDay.getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const list = []
    for (let i = 0; i < startOffset; i++) list.push(null)
    for (let day = 1; day <= daysInMonth; day++)
      list.push(new Date(year, month, day))
    return list
  }, [cursor])

  const selectedBookings = byDate[selected] || []
  const todayKey = toDateKey(new Date())

  return (
    <div>
      <div className="panel-heading">
        <h1>Calendar</h1>
        <p>Every booking, in chronological order, at a glance.</p>
      </div>

      <div className="calendar-layout">
        <div className="calendar">
          <div className="calendar__nav">
            <button
              className="icon-btn"
              onClick={() =>
                setCursor(
                  new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1),
                )
              }
            >
              ‹
            </button>
            <div className="calendar__month">{monthLabel}</div>
            <button
              className="icon-btn"
              onClick={() =>
                setCursor(
                  new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1),
                )
              }
            >
              ›
            </button>
          </div>
          <div className="calendar__grid calendar__grid--head">
            {DAYS_SHORT.map((d) => (
              <div key={d} className="calendar__weekday">
                {d}
              </div>
            ))}
          </div>
          <div className="calendar__grid">
            {cells.map((date, i) => {
              if (!date)
                return (
                  <div
                    key={i}
                    className="calendar__cell calendar__cell--empty"
                  />
                )
              const key = toDateKey(date)
              const dayBookings = byDate[key] || []
              const isSelected = key === selected
              const isToday = key === todayKey
              return (
                <button
                  key={i}
                  className={`calendar__cell ${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""}`}
                  onClick={() => setSelected(key)}
                >
                  <span className="calendar__daynum">{date.getDate()}</span>
                  {dayBookings.length > 0 && (
                    <span className="calendar__count">
                      {dayBookings.length}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="panel-block calendar__agenda">
          <div className="panel-block__head">
            <h2>{formatDate(selected)}</h2>
          </div>
          {selectedBookings.length === 0 && (
            <div className="empty-state">No bookings on this day.</div>
          )}
          <div className="agenda-list">
            {selectedBookings.map((b) => (
              <div className="agenda-row" key={b._id}>
                <div className="agenda-row__time">
                  <div className="agenda-row__time-sub">
                    {formatTime(b.time)}
                  </div>
                </div>
                <div className="agenda-row__body">
                  <div className="agenda-row__name">
                    {b.customerName || "Walk-in"}
                  </div>
                  <div className="agenda-row__service">
                    {formatServices(b.services)}
                  </div>
                  <div className="agenda-row__phone">
                    {formatPhone(b.customerPhone)}
                  </div>
                </div>
                <StatusStamp status={b.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- bookings ----------

const DUMMY_BOOKINGS = [
  {
    _id: "1",
    customerName: "Alex Mercer",
    customerPhone: "555-0101",
    services: ["Fade (Skin, Drop, Burst)"],
    date: "2026-07-24",
    time: "14:00",
    status: "confirmed",
    payment_status: "paid",
    price: 600,
  },
  {
    _id: "2",
    customerName: "Jordan Lee",
    customerPhone: "555-0102",
    services: ["Classic Scissor Cut"],
    date: "2026-07-24",
    time: "15:30",
    status: "pending",
    payment_status: "unpaid",
    price: 500,
  },
  {
    _id: "3",
    customerName: "Taylor Reed",
    customerPhone: "555-0103",
    services: ["Hot Towel Shave"],
    date: "2026-07-25",
    time: "10:00",
    status: "confirmed",
    payment_status: "pending",
    price: 600,
  },
  {
    _id: "4",
    customerName: "",
    customerPhone: "555-0104",
    services: ["Basic Beard Trim"],
    date: "2026-07-25",
    time: "11:15",
    status: "cancelled",
    payment_status: "unpaid",
    price: 250,
  },
  {
    _id: "5",
    customerName: "Chris Evans",
    customerPhone: "555-0105",
    services: ["Hair Spa / Deep Conditioning"],
    date: "2026-07-26",
    time: "16:00",
    status: "confirmed",
    payment_status: "paid",
    price: 1500,
  },
  {
    _id: "6",
    customerName: "Sam Smith",
    customerPhone: "555-0106",
    services: ["Wash & Blowout"],
    date: "2026-07-26",
    time: "13:00",
    status: "pending",
    payment_status: "unpaid",
    price: 800,
  },
]

function getInitials(name) {
  if (!name || name === "Walk-in") return "W"
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase()
}

function BookingCard({ booking }) {
  const isWalkIn = !booking.customerName
  const displayName = isWalkIn ? "Walk-in" : booking.customerName

  return (
    <div className="ticket advanced-ticket">
      <div
        className={`ticket__accent ticket__accent--${booking.status}`}
        aria-hidden="true"
      />
      <div className="ticket__body">
        <div className="ticket__header">
          <div className="ticket__avatar">{getInitials(displayName)}</div>
          <div className="ticket__info">
            <span className="ticket__name">{displayName}</span>
            <span className="ticket__phone">
              {formatPhone(booking.customerPhone)}
            </span>
          </div>
          <div className="ticket__status-wrapper">
            <StatusStamp status={booking.status} />
          </div>
        </div>

        <div className="ticket__details">
          <div className="detail-item">
            <span className="detail-label">Service</span>
            <span className="detail-value">
              {formatServices(booking.services)}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Schedule</span>
            <span className="detail-value">
              {formatDate(booking.date)} · {formatTime(booking.time)}
            </span>
          </div>
        </div>

        <div className="ticket__actions">
          <span className={`pay pay--${booking.payment_status || "unpaid"}`}>
            ● {booking.payment_status || "unpaid"}
          </span>
          <div className="btn-group">
            <button className="action-btn" title="Edit Booking">
              ✎
            </button>
            <button className="action-btn danger" title="Cancel Booking">
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function BookingRow({ booking }) {
  const isWalkIn = !booking.customerName
  const displayName = isWalkIn ? "Walk-in" : booking.customerName

  return (
    <tr className="booking-row">
      <td>
        <div className="row-customer">
          <div className="ticket__avatar ticket__avatar--small">
            {getInitials(displayName)}
          </div>
          <div>
            <div className="ticket__name">{displayName}</div>
            <div className="ticket__phone">
              {formatPhone(booking.customerPhone)}
            </div>
          </div>
        </div>
      </td>
      <td className="row-service">{formatServices(booking.services)}</td>
      <td>
        <div className="row-date">{formatDate(booking.date)}</div>
        <div className="row-time">{formatTime(booking.time)}</div>
      </td>
      <td>
        <StatusStamp status={booking.status} />
      </td>
      <td>
        <span className={`pay pay--${booking.payment_status || "unpaid"}`}>
          {booking.payment_status || "unpaid"}
        </span>
      </td>
      <td>
        <div className="btn-group">
          <button className="action-btn">Edit</button>
        </div>
      </td>
    </tr>
  )
}

function Bookings({ bookings, loading, error }) {
  const [filter, setFilter] = useState("all")
  const [service, setService] = useState("all")
  const [search, setSearch] = useState("")
  const [viewMode, setViewMode] = useState("grid")
  const [sortBy, setSortBy] = useState("date")

  const filteredAndSorted = useMemo(() => {
    const dataToUse =
      bookings && bookings.length > 0 && !error ? bookings : DUMMY_BOOKINGS

    let result = dataToUse.filter((b) => {
      if (filter !== "all" && b.status !== filter) return false
      if (service !== "all" && !(b.services || []).includes(service))
        return false

      if (search) {
        const query = search.toLowerCase()
        const name = (b.customerName || "walk-in").toLowerCase()
        const phone = (b.customerPhone || "").toLowerCase()
        if (!name.includes(query) && !phone.includes(query)) return false
      }
      return true
    })

    result.sort((a, b) => {
      if (sortBy === "name") {
        const nameA = (a.customerName || "Walk-in").toLowerCase()
        const nameB = (b.customerName || "Walk-in").toLowerCase()
        return nameA.localeCompare(nameB)
      } else {
        const dateA = new Date(`${a.date}T${a.time || "00:00"}`)
        const dateB = new Date(`${b.date}T${b.time || "00:00"}`)
        return dateB - dateA
      }
    })

    return result
  }, [bookings, filter, service, search, sortBy, error])

  return (
    <div className="bookings-module">
      <div className="panel-heading interactive-heading">
        <div>
          <h1>Bookings Ledger</h1>
          <p>Manage appointments, track payments, and update schedules.</p>
        </div>
        <div className="view-toggles">
          <button
            className={`icon-btn ${viewMode === "grid" ? "active" : ""}`}
            onClick={() => setViewMode("grid")}
          >
            ⊞
          </button>
          <button
            className={`icon-btn ${viewMode === "list" ? "active" : ""}`}
            onClick={() => setViewMode("list")}
          >
            ☰
          </button>
        </div>
      </div>

      <div className="advanced-toolbar">
        <div className="toolbar-search">
          <span className="search-icon">⌕</span>
          <input
            type="text"
            placeholder="Search name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="toolbar-filters">
          <div className="toolbar__group filter-tabs">
            {["all", "confirmed", "pending", "cancelled"].map((s) => (
              <button
                key={s}
                className={`tab-btn ${filter === s ? "is-active" : ""}`}
                onClick={() => setFilter(s)}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="dropdown-group">
            <select
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="select custom-select"
            >
              <option value="all">All Services</option>
              {SERVICES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="select custom-select"
            >
              <option value="date">Sort: Newest</option>
              <option value="name">Sort: Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {filteredAndSorted.length === 0 && (
        <div className="empty-state empty-state--modern">
          <div className="empty-icon">📂</div>
          <h3>No records found</h3>
          <p>Try adjusting your search or filters.</p>
          <button
            className="link-btn"
            onClick={() => {
              setSearch("")
              setFilter("all")
              setService("all")
            }}
          >
            Clear all filters
          </button>
        </div>
      )}

      {filteredAndSorted.length > 0 && viewMode === "grid" && (
        <div className="ticket-grid">
          {filteredAndSorted.map((b) => (
            <BookingCard key={b._id} booking={b} />
          ))}
        </div>
      )}

      {filteredAndSorted.length > 0 && viewMode === "list" && (
        <div className="table-container list-view-panel">
          <table className="advanced-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Service</th>
                <th>Schedule</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map((b) => (
                <BookingRow key={b._id} booking={b} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------- conversations ----------

function ConversationRow({ convo, isOpen, onToggle }) {
  const last = convo.messages?.[convo.messages.length - 1]
  let previewText = "No messages yet"
  if (last?.parts?.[0]?.text) {
    previewText = last.parts[0].text.slice(0, 80)
  } else if (typeof last?.content === "string") {
    previewText = last.content.slice(0, 80)
  }

  return (
    <div className="convo">
      <button className="convo__row" onClick={onToggle}>
        <div className="convo__phone">{formatPhone(convo.customerPhone)}</div>
        <div className="convo__preview">{previewText}</div>
        <div className="convo__count">{convo.messages?.length || 0} msgs</div>
        <span className={`convo__chevron ${isOpen ? "is-open" : ""}`}>›</span>
      </button>
      {isOpen && (
        <div className="convo__thread">
          {(convo.messages || []).map((m, i) => (
            <div key={i} className={`bubble bubble--${m.role}`}>
              <span className="bubble__role">
                {m.role === "user" ? "Customer" : "Alex"}
              </span>
              <span className="bubble__text">
                {m.parts?.[0]?.text || m.content}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Conversations({ conversations, loading, error }) {
  const [openId, setOpenId] = useState(null)

  return (
    <div>
      <div className="panel-heading">
        <h1>Conversations</h1>
        <p>WhatsApp threads between Alex and your customers.</p>
      </div>
      {loading && <div className="empty-state">Loading threads…</div>}
      {error && (
        <div className="empty-state empty-state--error">
          Couldn't load conversations: {error}
        </div>
      )}
      {!loading && !error && conversations.length === 0 && (
        <div className="empty-state">
          No conversations yet — they'll show up here as customers message in.
        </div>
      )}
      <div className="convo-list">
        {conversations.map((c) => (
          <ConversationRow
            key={c._id}
            convo={c}
            isOpen={openId === c._id}
            onToggle={() => setOpenId(openId === c._id ? null : c._id)}
          />
        ))}
      </div>
    </div>
  )
}

// ---------- analytics (Advanced BI Dashboard) ----------

function AnalyticsTab({ bookings, events }) {
  const [timeRange, setTimeRange] = useState(30)

  const filteredData = useMemo(() => {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - timeRange)

    const hasRealBookings = bookings && bookings.length > 0

    let activeBookings = []
    let activeEvents = []

    if (hasRealBookings) {
      activeBookings = bookings.filter((b) => new Date(b.date) >= cutoffDate)
      activeEvents = events
        ? events.filter((e) => new Date(e.timestamp) >= cutoffDate)
        : []
    } else {
      const dummyB = []
      const dummyE = []
      const servicesMix = [
        "Classic Scissor Cut",
        "Fade (Skin, Drop, Burst)",
        "Hot Towel Shave",
        "Beard Sculpting & Line-Up",
      ]
      const statuses = [
        "confirmed",
        "confirmed",
        "confirmed",
        "pending",
        "cancelled",
      ]

      for (let i = 0; i < timeRange * 3; i++) {
        const d = new Date()
        d.setDate(d.getDate() - Math.floor(Math.random() * timeRange))
        const s = servicesMix[Math.floor(Math.random() * servicesMix.length)]

        dummyB.push({
          _id: `d_${i}`,
          date: toDateKey(d),
          time: `${10 + Math.floor(Math.random() * 8)}:00`,
          services: [s],
          price: SERVICE_PRICE[s] || 500,
          status: statuses[Math.floor(Math.random() * statuses.length)],
          payment_status: Math.random() > 0.3 ? "paid" : "unpaid",
        })
      }

      for (let i = 0; i < timeRange * 8; i++)
        dummyE.push({ event_type: "started", timestamp: new Date() })
      for (let i = 0; i < timeRange * 5; i++)
        dummyE.push({ event_type: "booking_offered", timestamp: new Date() })
      for (let i = 0; i < timeRange * 3; i++)
        dummyE.push({ event_type: "booking_confirmed", timestamp: new Date() })

      activeBookings = dummyB.filter((b) => new Date(b.date) >= cutoffDate)
      activeEvents = dummyE
    }

    return { activeBookings, activeEvents }
  }, [bookings, events, timeRange])

  const metrics = useMemo(() => {
    const { activeBookings, activeEvents } = filteredData

    const trendMap = {}
    activeBookings.forEach((b) => {
      if (!trendMap[b.date])
        trendMap[b.date] = { date: b.date, revenue: 0, appointments: 0 }
      trendMap[b.date].appointments += 1
      if (b.status !== "cancelled" && b.payment_status === "paid") {
        trendMap[b.date].revenue += b.price || 0
      }
    })
    const trendChartData = Object.values(trendMap).sort(
      (a, b) => new Date(a.date) - new Date(b.date),
    )

    const serviceMap = {}
    activeBookings.forEach((b) => {
      if (b.status === "cancelled") return
      ;(b.services || []).forEach((s) => {
        serviceMap[s] = (serviceMap[s] || 0) + 1
      })
    })
    const serviceMixData = Object.keys(serviceMap).map((k) => ({
      name: k,
      value: serviceMap[k],
    }))

    const started = activeEvents.filter(
      (e) => e.event_type === "started",
    ).length
    const offered = activeEvents.filter(
      (e) => e.event_type === "booking_offered",
    ).length
    const confirmed = activeEvents.filter(
      (e) => e.event_type === "booking_confirmed",
    ).length
    const funnelData = [
      { name: "Chats Started", value: started },
      { name: "Availability Offered", value: offered },
      { name: "Bookings Confirmed", value: confirmed },
    ]

    let paidCount = 0
    let unpaidCount = 0
    activeBookings.forEach((b) => {
      if (b.status !== "cancelled") {
        if (b.payment_status === "paid") paidCount++
        else unpaidCount++
      }
    })
    const paymentData = [
      { name: "Paid", value: paidCount },
      { name: "Unpaid / Pending", value: unpaidCount },
    ]

    const totalRev = trendChartData.reduce((sum, day) => sum + day.revenue, 0)
    const convRate = started > 0 ? Math.round((confirmed / started) * 100) : 0

    return {
      trendChartData,
      serviceMixData,
      funnelData,
      paymentData,
      totalRev,
      convRate,
      totalAppts: activeBookings.length,
    }
  }, [filteredData])

  return (
    <div className="analytics-container">
      <div className="panel-heading interactive-heading">
        <div>
          <h1>Business Intelligence</h1>
          <p>
            Real-time insights derived from WhatsApp AI interactions and ledger
            data.
          </p>
        </div>
        <div className="view-toggles">
          <button
            className={`tab-btn ${timeRange === 7 ? "is-active" : ""}`}
            onClick={() => setTimeRange(7)}
          >
            7 Days
          </button>
          <button
            className={`tab-btn ${timeRange === 30 ? "is-active" : ""}`}
            onClick={() => setTimeRange(30)}
          >
            30 Days
          </button>
          <button
            className={`tab-btn ${timeRange === 365 ? "is-active" : ""}`}
            onClick={() => setTimeRange(365)}
          >
            All Time
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <Stat
          label="Total Revenue"
          value={`Rs. ${metrics.totalRev.toLocaleString()}`}
          sub={`Over last ${timeRange} days`}
        />
        <Stat
          label="Total Appointments"
          value={metrics.totalAppts}
          sub="Includes pending & walk-ins"
        />
        <Stat
          label="AI Chat Conversion"
          value={`${metrics.convRate}%`}
          sub="Lead to Confirmation"
        />
        <Stat
          label="Pending Payments"
          value={metrics.paymentData[1]?.value || 0}
          sub="Requires follow-up"
        />
      </div>

      <div className="charts-grid advanced-charts">
        <div className="panel-block chart-panel span-2">
          <div className="panel-block__head">
            <h2>Revenue & Appointment Volume Trend</h2>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart
                data={metrics.trendChartData}
                margin={{ top: 20, right: 20, bottom: 0, left: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e5e7eb"
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={(tick) => formatDate(tick).split(",")[0]}
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `Rs.${v}`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                  }}
                  labelFormatter={(l) => formatDate(l)}
                />
                <Legend />
                <Bar
                  yAxisId="right"
                  dataKey="appointments"
                  name="Appointments"
                  barSize={20}
                  fill="#dbeafe"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue Earned"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={{
                    r: 4,
                    fill: "#2563eb",
                    strokeWidth: 2,
                    stroke: "#fff",
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel-block chart-panel span-2">
          <div className="panel-block__head">
            <h2>WhatsApp AI Sales Funnel</h2>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                layout="vertical"
                data={metrics.funnelData}
                margin={{ top: 10, right: 30, left: 40, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="#e5e7eb"
                />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#374151", fontWeight: 600, fontSize: 13 }}
                  width={150}
                />
                <Tooltip
                  cursor={{ fill: "#f3f4f6" }}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                  }}
                />
                <Bar
                  dataKey="value"
                  name="Count"
                  fill="#10b981"
                  radius={[0, 4, 4, 0]}
                  barSize={32}
                >
                  {metrics.funnelData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel-block chart-panel">
          <div className="panel-block__head">
            <h2>Service Mix Breakdown</h2>
          </div>
          <div className="chart-wrapper pie-wrapper">
            {metrics.serviceMixData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={metrics.serviceMixData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {metrics.serviceMixData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    wrapperStyle={{ fontSize: "12px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">
                No service data for this period.
              </div>
            )}
          </div>
        </div>

        <div className="panel-block chart-panel">
          <div className="panel-block__head">
            <h2>Payment Status</h2>
          </div>
          <div className="chart-wrapper pie-wrapper">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={metrics.paymentData}
                  cx="50%"
                  cy="45%"
                  innerRadius={0}
                  outerRadius={90}
                  dataKey="value"
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#f59e0b" />
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                  }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- settings ----------
// UPDATE: Adding Worker count to hours, plus a new block for AI rules[cite: 1]
function SettingsTab() {
  const { config, setConfig, loading, saving, error, notFound, save } =
    useConfig()
  const [savedFlash, setSavedFlash] = useState(false)

  if (loading || !config) {
    return (
      <div>
        <div className="panel-heading">
          <h1>Settings</h1>
        </div>
        <div className="empty-state">Loading business settings…</div>
      </div>
    )
  }

  const updateDay = (day, patch) => {
    setConfig({
      ...config,
      daily_hours: config.daily_hours.map((d) =>
        d.day === day ? { ...d, ...patch } : d,
      ),
    })
  }

  const updateService = (name, patch) => {
    setConfig({
      ...config,
      services: config.services.map((s) =>
        s.name === name ? { ...s, ...patch } : s,
      ),
    })
  }

  const handleSave = async () => {
    const ok = await save(config)
    if (ok) {
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    }
  }

  return (
    <div>
      <div className="panel-heading">
        <h1>Business Customization</h1>
        <p>
          Set your hours, available workers, open services, and AI behaviors.
        </p>
      </div>

      {notFound && (
        <div className="empty-state empty-state--warning">
          No <code>/api/config</code> route found yet on the server — showing
          defaults. Add the route shown in the setup notes to save changes for
          real.
        </div>
      )}
      {error && <div className="empty-state empty-state--error">{error}</div>}

      <div className="panel-block">
        <div className="panel-block__head">
          <h2>Weekly hours & Workforce</h2>
        </div>
        <div className="hours-table">
          {config.daily_hours.map((d) => (
            <div className="hours-row" key={d.day}>
              <label className="hours-row__day" style={{ minWidth: "120px" }}>
                <input
                  type="checkbox"
                  checked={!d.closed}
                  onChange={(e) =>
                    updateDay(d.day, { closed: !e.target.checked })
                  }
                />
                {d.day}
              </label>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  minWidth: "130px",
                }}
              >
                <span style={{ fontSize: "0.9rem", color: "#6b7280" }}>
                  Workers:
                </span>
                <input
                  type="number"
                  min="1"
                  className="number-input"
                  style={{ width: "60px", padding: "6px" }}
                  value={d.workers || 1}
                  disabled={d.closed}
                  onChange={(e) =>
                    updateDay(d.day, { workers: Number(e.target.value) })
                  }
                />
              </div>

              <input
                type="time"
                className="time-input"
                value={d.open}
                disabled={d.closed}
                onChange={(e) => updateDay(d.day, { open: e.target.value })}
              />
              <span className="hours-row__to">to</span>
              <input
                type="time"
                className="time-input"
                value={d.close}
                disabled={d.closed}
                onChange={(e) => updateDay(d.day, { close: e.target.value })}
              />
              {d.closed && <span className="hours-row__closed">Closed</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="two-col">
        <div className="panel-block">
          <div className="panel-block__head">
            <h2>Services offered today</h2>
          </div>
          <div className="service-list">
            {config.services.map((s) => (
              <label className="service-row" key={s.name}>
                <span>
                  <span className="service-row__name">{s.name}</span>
                  <span className="service-row__meta">
                    Rs. {s.price} · {s.duration_minutes} min
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={!s.paused}
                  onChange={(e) =>
                    updateService(s.name, { paused: !e.target.checked })
                  }
                />
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div className="panel-block" style={{ marginBottom: 0 }}>
            <div className="panel-block__head">
              <h2>AI Chat & Handoff</h2>
            </div>
            <div className="field-row field-row--toggle">
              <label htmlFor="negotiation">
                Enable AI Price Negotiation (Max 10%)
              </label>
              <input
                id="negotiation"
                type="checkbox"
                checked={config.enable_negotiation || false}
                onChange={(e) =>
                  setConfig({ ...config, enable_negotiation: e.target.checked })
                }
              />
            </div>
            <div className="field-row">
              <label htmlFor="handoff">
                Auto-Handoff Message Limit <br />
                <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                  (Triggers owner intervention for spam/lost context)
                </span>
              </label>
              <input
                id="handoff"
                type="number"
                min="1"
                className="number-input"
                value={config.message_handoff_limit || 20}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    message_handoff_limit: Number(e.target.value),
                  })
                }
              />
            </div>
          </div>

          <div className="panel-block" style={{ marginBottom: 0 }}>
            <div className="panel-block__head">
              <h2>Capacity & Workflow</h2>
            </div>
            <div className="field-row">
              <label htmlFor="cap">Max customers for the day</label>
              <input
                id="cap"
                type="number"
                min="0"
                className="number-input"
                placeholder="No limit"
                value={config.daily_customer_cap ?? ""}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    daily_customer_cap:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="field-row">
              <label htmlFor="buffer">Buffer between bookings (minutes)</label>
              <input
                id="buffer"
                type="number"
                min="0"
                className="number-input"
                value={config.buffer_minutes}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    buffer_minutes: Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="field-row field-row--toggle">
              <label htmlFor="manual">
                Manual override (owner handling chats)
              </label>
              <input
                id="manual"
                type="checkbox"
                checked={config.manual_override}
                onChange={(e) =>
                  setConfig({ ...config, manual_override: e.target.checked })
                }
              />
            </div>
            <div className="field-row field-row--toggle">
              <label htmlFor="approve">
                Approve bookings before confirming
              </label>
              <input
                id="approve"
                type="checkbox"
                checked={config.approve_before_confirm}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    approve_before_confirm: e.target.checked,
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className="settings-save">
        <button className="save-btn" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        {savedFlash && <span className="settings-save__flash">Saved ✓</span>}
      </div>
    </div>
  )
}

// ---------- landscape guard ----------

function LandscapeGuard({ children }) {
  return (
    <>
      <div className="rotate-notice">
        <div className="rotate-notice__icon">⟳</div>
        <div>This dashboard is built for a wide, landscape screen.</div>
        <div className="rotate-notice__sub">
          Rotate your device or widen the window to continue.
        </div>
      </div>
      <div className="landscape-only">{children}</div>
    </>
  )
}

// ---------- app shell ----------

export default function App() {
  const [tab, setTab] = useState("overview")
  const bookingsQ = useFetchList("/api/bookings")
  const conversationsQ = useFetchList("/api/conversations")
  const analyticsQ = useFetchList("/api/analytics")

  const events = analyticsQ.data

  return (
    <LandscapeGuard>
      <div className="app">
        <Sidebar
          active={tab}
          onSelect={setTab}
          counts={{
            bookings: bookingsQ.data.length,
            conversations: conversationsQ.data.length,
          }}
        />
        <main className="main">
          {tab === "overview" && (
            <Overview
              bookings={bookingsQ.data}
              events={events}
              onNavigate={setTab}
            />
          )}
          {tab === "calendar" && <CalendarTab bookings={bookingsQ.data} />}
          {tab === "bookings" && (
            <Bookings
              bookings={bookingsQ.data}
              loading={bookingsQ.loading}
              error={bookingsQ.error}
            />
          )}
          {tab === "conversations" && (
            <Conversations
              conversations={conversationsQ.data}
              loading={conversationsQ.loading}
              error={conversationsQ.error}
            />
          )}
          {tab === "analytics" && (
            <AnalyticsTab bookings={bookingsQ.data} events={events} />
          )}
          {tab === "settings" && <SettingsTab />}
        </main>
      </div>
    </LandscapeGuard>
  )
}
