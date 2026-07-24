import "./env.js"
import mongoose from "mongoose"
import { Booking } from "./models.js"

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
  "Aayush", "Bikash", "Sujata", "Prakash", "Anita", "Rajesh", "Sarina",
  "Kiran", "Manisha", "Sandeep", "Nisha", "Suman", "Priya", "Bibek",
  "Sabina", "Rohan", "Anjali", "Dipesh", "Sunita", "Prashant", "Rina",
  "Nabin", "Kritika", "Sagar", "Puja",
]
const LAST_NAMES = [
  "Shrestha", "Tamang", "Gurung", "Rai", "Thapa", "Karki", "Basnet",
  "Dhakal", "Adhikari", "Poudel", "Magar", "Bhattarai", "Khadka", "Limbu",
]

const STATUSES = ["confirmed", "confirmed", "confirmed", "pending", "cancelled"]
const PAYMENT_STATES = ["paid", "unpaid", "pending"]

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomPhone() {
  return `9779${Math.floor(700000000 + Math.random() * 99999999)}@c.us`
}

function randomTimeSlot() {
  const hour = 10 + Math.floor(Math.random() * 9) // 10am - 6pm
  const minute = Math.random() > 0.5 ? "00" : "30"
  return `${String(hour).padStart(2, "0")}:${minute}`
}

async function seed() {
  await mongoose.connect(process.env.MONGO_URI)
  console.log("Mongo connected — seeding dummy bookings...")

  const dates = ["2026-07-24", "2026-07-25"]
  const bookingsToInsert = []

  for (let i = 0; i < 25; i++) {
    const date = randomFrom(dates)
    const numServices = Math.random() > 0.7 ? 2 : 1 // some bundled bookings
    const services = []
    while (services.length < numServices) {
      const s = randomFrom(SERVICE_NAMES)
      if (!services.includes(s)) services.push(s)
    }

    const price = services.reduce((sum, s) => sum + SERVICES_DB[s].price, 0)
    const duration = services.reduce(
      (sum, s) => sum + SERVICES_DB[s].duration,
      0,
    )

    const status = randomFrom(STATUSES)
    // cancelled bookings are usually unpaid; confirmed/pending can be anything
    const payment_status =
      status === "cancelled" ? "unpaid" : randomFrom(PAYMENT_STATES)

    bookingsToInsert.push({
      customerName: `${randomFrom(FIRST_NAMES)} ${randomFrom(LAST_NAMES)}`,
      customerPhone: randomPhone(),
      services,
      date,
      time: randomTimeSlot(),
      duration,
      price,
      status,
      payment_status,
      createdAt: new Date(),
    })
  }

  const inserted = await Booking.insertMany(bookingsToInsert)
  console.log(`Inserted ${inserted.length} dummy bookings for July 24–25, 2026.`)

  await mongoose.disconnect()
  process.exit(0)
}

seed().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
