import "./env.js"
import mongoose from "mongoose"
import { Booking, ConversationEvent } from "./models.js"

const SERVICES_DB = {
  "Classic Scissor Cut": { price: 500, duration: 30 },
  "Fade (Skin, Drop, Burst)": { price: 600, duration: 30 },
  "Buzz Cut": { price: 350, duration: 30 },
  "Pixie Cut": { price: 800, duration: 30 },
  "Line-Up / Edge-Up": { price: 200, duration: 15 },
  "Kids Haircut": { price: 350, duration: 30 },
  "Trim / Dusting": { price: 600, duration: 30 },
  "Layered Cut": { price: 1200, duration: 45 },
  "Bob / Lob Cut": { price: 1000, duration: 45 },
  "Wash, Cut & Blowout": { price: 1800, duration: 60 },
  "Basic Beard Trim": { price: 250, duration: 15 },
  "Beard Sculpting & Line-Up": { price: 400, duration: 30 },
  "Hot Towel Shave": { price: 600, duration: 30 },
  "Head Shave": { price: 600, duration: 30 },
  "Root Touch-Up": { price: 1500, duration: 60 },
  "All-Over Color": { price: 3500, duration: 90 },
  "Highlights / Lowlights": { price: 4500, duration: 90 },
  "Hair Spa / Deep Conditioning": { price: 1500, duration: 45 },
  "Scalp Detox & Massage": { price: 1000, duration: 30 },
  "Wash & Blowout": { price: 800, duration: 30 },
  "Hot Tool Styling": { price: 800, duration: 30 },
  "Eyebrow Threading": { price: 100, duration: 15 },
  "Nose / Ear Waxing": { price: 300, duration: 15 },
  "Express Facial / Clean-up": { price: 1200, duration: 30 },
}

const SERVICE_NAMES = Object.keys(SERVICES_DB)

const FIRST_NAMES = [
  "Aayush",
  "Bikash",
  "Sujata",
  "Prakash",
  "Anita",
  "Rajesh",
  "Sarina",
  "Kiran",
  "Manisha",
  "Sandeep",
  "Nisha",
  "Suman",
  "Priya",
  "Bibek",
  "Sabina",
  "Rohan",
  "Anjali",
  "Dipesh",
  "Sunita",
  "Prashant",
  "Rina",
  "Nabin",
  "Kritika",
  "Sagar",
  "Puja",
]
const LAST_NAMES = [
  "Shrestha",
  "Tamang",
  "Gurung",
  "Rai",
  "Thapa",
  "Karki",
  "Basnet",
  "Dhakal",
  "Adhikari",
  "Poudel",
  "Magar",
  "Bhattarai",
  "Khadka",
  "Limbu",
]

// Phone/metadata markers used to identify (and later clean up) seeded
// data. Consistent across seed runs so re-running this script is safe
// and idempotent - it clears its own previous output first.
const SEED_PHONE_REGEX = /^9779\d+@c\.us$/
const SEED_EVENT_TAG = "seed-script"

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1))
}

function randomPhone() {
  return `9779${Math.floor(700000000 + Math.random() * 99999999)}@c.us`
}

function randomTimeSlot() {
  const hour = 10 + Math.floor(Math.random() * 9) // 10am - 6pm
  const minute = Math.random() > 0.5 ? "00" : "30"
  return `${String(hour).padStart(2, "0")}:${minute}`
}

function toDateKey(d) {
  return d.toISOString().slice(0, 10)
}

function isSunday(d) {
  return d.getDay() === 0
}

function randomBookingRecord(dateKey) {
  const numServices = Math.random() > 0.75 ? 2 : 1
  const services = []
  while (services.length < numServices) {
    const s = randomFrom(SERVICE_NAMES)
    if (!services.includes(s)) services.push(s)
  }

  const price = services.reduce((sum, s) => sum + SERVICES_DB[s].price, 0)
  const duration = services.reduce((sum, s) => sum + SERVICES_DB[s].duration, 0)

  // Weighted status: mostly confirmed, some pending, few cancelled
  const statusRoll = Math.random()
  const status =
    statusRoll < 0.72 ? "confirmed" : statusRoll < 0.9 ? "pending" : "cancelled"

  // Weighted payment: mostly paid, some unpaid/pending - cancelled is unpaid
  let payment_status
  if (status === "cancelled") {
    payment_status = "unpaid"
  } else {
    const payRoll = Math.random()
    payment_status =
      payRoll < 0.62 ? "paid" : payRoll < 0.85 ? "unpaid" : "pending"
  }

  return {
    customerName: `${randomFrom(FIRST_NAMES)} ${randomFrom(LAST_NAMES)}`,
    customerPhone: randomPhone(),
    services,
    date: dateKey,
    time: randomTimeSlot(),
    duration,
    price,
    status,
    payment_status,
    createdAt: new Date(),
  }
}

async function seed() {
  await mongoose.connect(process.env.MONGO_URI)
  console.log("Mongo connected.")

  // --- UNDO previous dummy data (safe to re-run this script anytime) ---
  const deletedBookings = await Booking.deleteMany({
    customerPhone: SEED_PHONE_REGEX,
  })
  const deletedEvents = await ConversationEvent.deleteMany({
    metadata: SEED_EVENT_TAG,
  })
  console.log(
    `Cleared previous dummy data: ${deletedBookings.deletedCount} bookings, ${deletedEvents.deletedCount} events.`,
  )

  // --- Build the trailing 30-day window ending today, skipping Sundays ---
  const TOTAL_DAYS = 30
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const bookingsToInsert = []

  for (let i = TOTAL_DAYS - 1; i >= 0; i--) {
    const day = new Date(today)
    day.setDate(today.getDate() - i)

    if (isSunday(day)) continue // shop is closed Sundays - no bookings ever

    const dateKey = toDateKey(day)

    // Vary daily volume so the trend chart has real peaks and valleys:
    // ~15% "spike" days, ~60% normal days, ~25% quiet days.
    const dayRoll = Math.random()
    let bookingCount
    if (dayRoll < 0.15) {
      bookingCount = randomInt(6, 9) // spike day
    } else if (dayRoll < 0.75) {
      bookingCount = randomInt(1, 3) // normal day
    } else {
      bookingCount = randomInt(0, 1) // quiet day
    }

    for (let j = 0; j < bookingCount; j++) {
      bookingsToInsert.push(randomBookingRecord(dateKey))
    }
  }

  const insertedBookings = await Booking.insertMany(bookingsToInsert)
  console.log(
    `Inserted ${insertedBookings.length} dummy bookings across the last ${TOTAL_DAYS} days (Sundays skipped).`,
  )

  // --- Seed ConversationEvents so the WhatsApp AI Sales Funnel chart populates ---
  // Ratios roughly matching a healthy but realistic funnel:
  // Chats Started -> ~68% get availability offered -> ~47% end in a confirmed booking.
  const STARTED = 150
  const OFFERED = Math.round(STARTED * 0.68)
  const CONFIRMED = Math.round(STARTED * 0.47)

  const eventsToInsert = []
  const pushEvents = (count, event_type) => {
    for (let i = 0; i < count; i++) {
      // spread event timestamps across the same 30-day window
      const daysAgo = randomInt(0, TOTAL_DAYS - 1)
      const ts = new Date(today)
      ts.setDate(today.getDate() - daysAgo)
      ts.setHours(randomInt(10, 18), randomInt(0, 59))
      eventsToInsert.push({
        customerPhone: randomPhone(),
        event_type,
        metadata: SEED_EVENT_TAG,
        timestamp: ts,
      })
    }
  }

  pushEvents(STARTED, "started")
  pushEvents(OFFERED, "booking_offered")
  pushEvents(CONFIRMED, "booking_confirmed")

  const insertedEvents = await ConversationEvent.insertMany(eventsToInsert)
  console.log(
    `Inserted ${insertedEvents.length} conversation events (started: ${STARTED}, offered: ${OFFERED}, confirmed: ${CONFIRMED}).`,
  )

  await mongoose.disconnect()
  console.log("Done.")
  process.exit(0)
}

seed().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
