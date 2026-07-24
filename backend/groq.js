import Groq from "groq-sdk"
import "./env.js"
import { Booking, BusinessConfig, ConversationEvent } from "./models.js"

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

const FALLBACK_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "mixtral-8x7b-32768",
]

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
  "Bangs / Fringe Trim": { price: 300, duration: 15 },
  "Basic Beard Trim": { price: 250, duration: 15 },
  "Beard Sculpting & Line-Up": { price: 400, duration: 30 },
  "Hot Towel Shave": { price: 600, duration: 30 },
  "Mustache Trim": { price: 150, duration: 15 },
  "Head Shave": { price: 600, duration: 30 },
  "Root Touch-Up": { price: 1500, duration: 60 },
  "All-Over Color": { price: 3500, duration: 90 },
  "Highlights / Lowlights": { price: 4500, duration: 90 },
  "Balayage / Ombre": { price: 6000, duration: 120 },
  "Bleach & Tone": { price: 5000, duration: 120 },
  "Camo Color (Men)": { price: 1000, duration: 30 },
  "Hair Spa / Deep Conditioning": { price: 1500, duration: 45 },
  "Scalp Detox & Massage": { price: 1000, duration: 30 },
  "Keratin / Smoothening": { price: 6000, duration: 120 },
  "Perm (Standard/Modern)": { price: 3000, duration: 120 },
  "Wash & Blowout": { price: 800, duration: 30 },
  "Hot Tool Styling": { price: 800, duration: 30 },
  "Special Occasion Updo": { price: 2000, duration: 60 },
  "Hair Straightening / Rebonding": { price: 5000, duration: 180 },
  "Eyebrow Threading": { price: 100, duration: 15 },
  "Nose / Ear Waxing": { price: 300, duration: 15 },
  "Express Facial / Clean-up": { price: 1200, duration: 30 },
  "D-Tan / Blackhead Peel Mask": { price: 600, duration: 30 },
}

// System prompt is now a function so it can calculate the date dynamically
const getSystemPrompt =
  () => `You are Alex, the AI front-desk manager for 'Fade & Blade Barbershop'.
You communicate with customers over WhatsApp. Your job is to answer questions, negotiate bookings, and close appointments.

=== BUSINESS INFO ===
Name: Fade & Blade Barbershop
Today's Date: ${new Date().toISOString().split("T")[0]} (Always use this as "today" for booking availability).
Hours: Mon-Sat, 10:00 AM - 7:00 PM. Closed Sundays.
Payment methods accepted: Cash, Card, eSewa/Khalti (mention if asked)
Walk-ins: Accepted, but booked customers get priority.

Services & Pricing Guide:

CRITICAL RULE FOR SHOWING SERVICES:
- When a customer asks about services, options, or pricing, FIRST ONLY list out the 7 main base service categories:
  1. Men's & Short Haircuts
  2. Women's & Long Haircuts
  3. Beard & Facial Hair Grooming
  4. Hair Coloring
  5. Hair & Scalp Treatments
  6. Styling & Finishing
  7. Additional Grooming Services
- DO NOT list sub-options, prices, or descriptions initially. Ask the customer which category they are interested in.
- ONLY when a customer chooses or asks about a specific category, show the options with prices and details for THAT category only.
- DO NOT use markdown tables or heavy markdown formatting. Output everything in clean, simple plain-text lists suitable for WhatsApp.
- IMPORTANT: When booking, you must use the exact exact name of the sub-service (e.g. "Highlights / Lowlights" instead of "highlights").

Categories & Sub-Option Details:

1. Men's & Short Haircuts:
   - Classic Scissor Cut (Rs. 500)
   - Fade (Skin, Drop, Burst) (Rs. 600)
   - Buzz Cut (Rs. 350)
   - Pixie Cut (Rs. 800)
   - Line-Up / Edge-Up (Rs. 200)
   - Kids Haircut (Rs. 350)

2. Women's & Long Haircuts:
   - Trim / Dusting (Rs. 600)
   - Layered Cut (Rs. 1,200)
   - Bob / Lob Cut (Rs. 1,000)
   - Wash, Cut & Blowout (Rs. 1,800)
   - Bangs / Fringe Trim (Rs. 300)

3. Beard & Facial Hair Grooming:
   - Basic Beard Trim (Rs. 250)
   - Beard Sculpting & Line-Up (Rs. 400)
   - Hot Towel Shave (Rs. 600)
   - Mustache Trim (Rs. 150)
   - Head Shave (Rs. 600)

4. Hair Coloring:
   - Root Touch-Up (Rs. 1,500)
   - All-Over Color (Rs. 3,500+)
   - Highlights / Lowlights (Rs. 4,500+)
   - Balayage / Ombre (Rs. 6,000+)
   - Bleach & Tone (Rs. 5,000+)
   - Camo Color (Men) (Rs. 1,000)

5. Hair & Scalp Treatments:
   - Hair Spa / Deep Conditioning (Rs. 1,500)
   - Scalp Detox & Massage (Rs. 1,000)
   - Keratin / Smoothening (Rs. 6,000+)
   - Perm (Standard/Modern) (Rs. 3,000+)

6. Styling & Finishing:
   - Wash & Blowout (Rs. 800)
   - Hot Tool Styling (Rs. 800)
   - Special Occasion Updo (Rs. 2,000+)
   - Hair Straightening / Rebonding (Rs. 5,000+)

7. Additional Grooming Services:
   - Eyebrow Threading (Rs. 100)
   - Nose / Ear Waxing (Rs. 300)
   - Express Facial / Clean-up (Rs. 1,200)
   - D-Tan / Blackhead Peel Mask (Rs. 600)

=== YOUR PERSONALITY ===
- Warm, brief, conversational. Max 1 emoji per message.
- Never sound like a robot or read out disclaimers.
- Always end a message with a clear next step or question that moves toward a booking, UNLESS they decline.

=== CORE RULES ===
1. NEVER invent availability. Always call check_availability before offering or confirming any time slot.
2. If a requested time isn't available, immediately offer the next two nearest available slots.
3. If the request is missing details (no service, no date, or no time), ask ONE clarifying question at a time.
4. Before calling book_appointment, confirm out loud: all requested services, date, time, and TOTAL price — get an explicit "yes/confirm".
5. If a customer wants to cancel or reschedule, use modify_booking or cancel_booking.

Always act within these rules. Never expose internal function names or business logic to the customer.`

const tools = [
  {
    type: "function",
    function: {
      name: "check_availability",
      description:
        "Check open time slots for a given date and multiple services. Calculates total time needed.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          services: {
            type: "array",
            items: { type: "string" },
            description: "List of exact service names requested",
          },
        },
        required: ["date", "services"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_appointment",
      description: "Create a confirmed booking for one or more services.",
      parameters: {
        type: "object",
        properties: {
          services: {
            type: "array",
            items: { type: "string" },
            description: "List of exact service names requested",
          },
          date: { type: "string", description: "YYYY-MM-DD" },
          time: { type: "string", description: "HH:MM" },
        },
        required: ["services", "date", "time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "modify_booking",
      description: "Reschedule an existing booking to a new date/time.",
      parameters: {
        type: "object",
        properties: {
          booking_id: { type: "string" },
          new_date: { type: "string" },
          new_time: { type: "string" },
        },
        required: ["booking_id", "new_date", "new_time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_booking",
      description: "Cancel an existing booking.",
      parameters: {
        type: "object",
        properties: {
          booking_id: { type: "string" },
        },
        required: ["booking_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lookup_customer_bookings",
      description: "Find existing upcoming bookings for this customer.",
      parameters: {
        type: "object",
        properties: {
          customer_phone: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_conversation_event",
      description:
        "Log analytics (e.g., booking_offered, booking_confirmed, faq_answered).",
      parameters: {
        type: "object",
        properties: {
          event_type: { type: "string" },
          metadata: { type: "string" },
        },
        required: ["event_type"],
      },
    },
  },
]

// --- TOOL IMPLEMENTATIONS ---
async function checkAvailability({ date, services = [] }) {
  let reqDuration = 0
  for (const s of services) {
    reqDuration += SERVICES_DB[s]?.duration || 30
  }
  const slotsNeeded = Math.max(1, Math.ceil(reqDuration / 30))

  const existing = await Booking.find({ date, status: { $ne: "cancelled" } })
  const bookedSlots = new Set()

  for (const b of existing) {
    const bDuration = b.duration || 30
    const bSlots = Math.ceil(bDuration / 30)
    let [h, m] = b.time.split(":").map(Number)

    for (let i = 0; i < bSlots; i++) {
      const t = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
      bookedSlots.add(t)
      m += 30
      if (m >= 60) {
        h++
        m -= 60
      }
    }
  }

  const availableStartTimes = []
  for (let h = 10; h < 19; h++) {
    for (let m of [0, 30]) {
      let canFit = true
      let checkH = h
      let checkM = m

      for (let i = 0; i < slotsNeeded; i++) {
        const t = `${String(checkH).padStart(2, "0")}:${String(checkM).padStart(2, "0")}`
        if (bookedSlots.has(t) || checkH >= 19) {
          canFit = false
          break
        }
        checkM += 30
        if (checkM >= 60) {
          checkH++
          checkM -= 60
        }
      }

      if (canFit) {
        availableStartTimes.push(
          `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
        )
      }
    }
  }

  return {
    available_slots: availableStartTimes.slice(0, 5),
    total_estimated_duration_minutes: reqDuration,
  }
}

async function bookAppointment({ services = [], date, time }, phone, name) {
  const config = (await BusinessConfig.findOne()) || {}
  const status = config.approve_before_confirm ? "pending" : "confirmed"

  let totalPrice = 0
  let totalDuration = 0

  for (const s of services) {
    totalPrice += SERVICES_DB[s]?.price || 0
    totalDuration += SERVICES_DB[s]?.duration || 30
  }

  const booking = await Booking.create({
    customerName: name,
    customerPhone: phone,
    services,
    date,
    time,
    duration: totalDuration,
    price: totalPrice,
    status,
  })

  return {
    booking_id: booking._id.toString(),
    status,
    total_price: totalPrice,
    total_duration_minutes: totalDuration,
  }
}

async function modifyBooking({ booking_id, new_date, new_time }) {
  const booking = await Booking.findByIdAndUpdate(
    booking_id,
    { date: new_date, time: new_time },
    { new: true },
  )
  return booking
    ? { status: "rescheduled", booking }
    : { error: "Booking not found" }
}

async function cancelBooking({ booking_id }) {
  await Booking.findByIdAndUpdate(booking_id, { status: "cancelled" })
  return { status: "cancelled" }
}

async function lookupCustomerBookings({ customer_phone }, phone) {
  const bookings = await Booking.find({
    customerPhone: phone,
    status: { $ne: "cancelled" },
  })
  return { bookings }
}

async function logConversationEvent({ event_type, metadata }, phone) {
  await ConversationEvent.create({ customerPhone: phone, event_type, metadata })
  return { success: true }
}

async function generateWithFailover(messages) {
  let lastError
  for (const modelName of FALLBACK_MODELS) {
    try {
      return await groq.chat.completions.create({
        model: modelName,
        messages: [{ role: "system", content: getSystemPrompt() }, ...messages],
        tools,
        tool_choice: "auto",
      })
    } catch (err) {
      lastError = err
      const isRateLimitOrOverload = err?.status === 429 || err?.status === 503
      if (isRateLimitOrOverload) {
        console.log(
          `[${err.status} Error on ${modelName}] Switching to backup model...`,
        )
        continue
      }
      throw err
    }
  }

  console.log(
    `[Groq API Spike] All fallbacks exhausted. Retrying primary in 2s...`,
  )
  await new Promise((res) => setTimeout(res, 2000))

  return await groq.chat.completions.create({
    model: FALLBACK_MODELS[0],
    messages: [{ role: "system", content: getSystemPrompt() }, ...messages],
    tools,
    tool_choice: "auto",
  })
}

export async function runChat(phone, name, userMessage, history) {
  // Normalize history to handle BOTH legacy database strings AND new native Groq objects
  const messages = (history || [])
    .map((h) => {
      // Legacy schema support
      if (h.parts) {
        return {
          role: h.role === "model" ? "assistant" : h.role,
          content: h.parts.map((p) => p.text || "").join("\n"),
        }
      }
      // Native Groq schema pass-through
      return h
    })
    .filter((m) => (m.content || m.tool_calls) && m.role)

  // Push user message natively
  messages.push({ role: "user", content: userMessage })

  let response = await generateWithFailover(messages)
  let responseMessage = response.choices[0].message

  while (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
    messages.push(responseMessage) // Push assistant tool intent

    for (const toolCall of responseMessage.tool_calls) {
      const toolName = toolCall.function.name
      let args = {}
      try {
        args = JSON.parse(toolCall.function.arguments || "{}")
      } catch (e) {
        args = {}
      }

      let output
      if (toolName === "check_availability")
        output = await checkAvailability(args)
      else if (toolName === "book_appointment")
        output = await bookAppointment(args, phone, name)
      else if (toolName === "modify_booking") output = await modifyBooking(args)
      else if (toolName === "cancel_booking") output = await cancelBooking(args)
      else if (toolName === "lookup_customer_bookings")
        output = await lookupCustomerBookings(args, phone)
      else if (toolName === "log_conversation_event")
        output = await logConversationEvent(args, phone)
      else output = { error: "unknown function" }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        name: toolName,
        content: JSON.stringify(output),
      })
    }

    response = await generateWithFailover(messages)
    responseMessage = response.choices[0].message
  }

  // Ensure the AI's final text answer is added to history for context retention
  if (responseMessage) {
    messages.push(responseMessage)
  }

  return {
    replyText: responseMessage.content || "",
    updatedHistory: messages, // Passes the full native array back out to save in DB
  }
}
