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

// Helper to get exact local date, day, and time
function getNowInfo() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  const dateStr = `${year}-${month}-${day}`

  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ]
  const dayName = dayNames[now.getDay()]

  const hours = String(now.getHours()).padStart(2, "0")
  const minutes = String(now.getMinutes()).padStart(2, "0")
  const timeStr = `${hours}:${minutes}`

  const h12 = now.getHours() % 12 || 12
  const ampm = now.getHours() >= 12 ? "PM" : "AM"
  const time12Str = `${h12}:${minutes} ${ampm}`

  return {
    dateStr,
    dayName,
    timeStr,
    time12Str,
    nowHours: now.getHours(),
    nowMinutes: now.getMinutes(),
  }
}

// System prompt is now a function so it can calculate the date and time dynamically
const getSystemPrompt = () => {
  const { dateStr, dayName, timeStr, time12Str } = getNowInfo()
  return `You are Alex, the AI front-desk manager for 'Fade & Blade Barbershop'.
You communicate with customers over WhatsApp. Your job is to answer questions, negotiate bookings, and close appointments.

=== BUSINESS INFO ===
Name: Fade & Blade Barbershop
Today's Date & Current Time: ${dateStr} (${dayName}), ${time12Str} (${timeStr} 24h format). Always use this as "today" and "now" for booking availability calculations.
Hours: Mon-Sat, 10:00 AM - 7:00 PM. CLOSED on Sundays — no exceptions, no appointments of any kind on Sundays.
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
6. We are CLOSED every Sunday. If a customer asks for a Sunday date, or if a tool result comes back indicating the shop is closed that day, tell them plainly that we're closed on Sundays and ask them to pick a different day (Monday–Saturday). Never offer or confirm a Sunday appointment.
7. NEVER write out function names, JSON, code blocks, or any tool/function-call syntax in your reply to the customer. You only have two output channels: (a) the official tool-calling mechanism to invoke a function, or (b) plain natural-language text back to the customer. Nothing else is ever shown to the customer directly — no raw JSON, no "<function=...>" tags, no code of any kind.
8. AFTER an appointment is booked or confirmed (or when discussing payment), ask the customer: "Would you like to pay online via QR code (eSewa / Khalti / Fonepay) or cash at the shop?"
9. If the customer indicates they want to pay ONLINE (e.g. saying "online", "QR", "eSewa", "Khalti", "send QR", "pay online"), respond warmly with payment instructions and INCLUDE the tag [SEND_PAYMENT_QR] in your reply (e.g., "Awesome! Here is our official QR code for eSewa / Khalti. [SEND_PAYMENT_QR] Please let us know once paid!"). Also invoke tool set_payment_method with method="online".
10. If the customer indicates they want to pay CASH at the shop, confirm that cash payment is noted and call set_payment_method with method="cash".
11. CRITICAL: Never offer or book time slots in the past for today's date (${dateStr}). Current local time is ${time12Str}.

Always act within these rules. Never expose internal function names or business logic to the customer.`
}

const tools = [
  {
    type: "function",
    function: {
      name: "check_availability",
      description:
        "Check open time slots for a given date and multiple services. Calculates total time needed. Returns closed:true if the date is a Sunday.",
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
      description:
        "Create a confirmed booking for one or more services. Fails if the date is a Sunday.",
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
      name: "set_payment_method",
      description: "Set customer payment method preference (cash or online) for their booking.",
      parameters: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["cash", "online"] },
        },
        required: ["method"],
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

// --- DAY-OF-WEEK / CLOSED-DAY HELPERS ---

// Parsing "YYYY-MM-DD" with an explicit T00:00:00 avoids UTC-vs-local
// off-by-one bugs that plain `new Date("YYYY-MM-DD")` can cause.
function getDayOfWeek(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.getDay() // 0 = Sunday
}

function isClosedDay(dateStr) {
  return getDayOfWeek(dateStr) === 0
}

// --- TOOL IMPLEMENTATIONS ---
async function checkAvailability({ date, services = [] }) {
  if (isClosedDay(date)) {
    return {
      closed: true,
      reason: "Fade & Blade Barbershop is closed on Sundays.",
      available_slots: [],
      total_estimated_duration_minutes: 0,
    }
  }

  const nowInfo = getNowInfo()
  const isToday = date === nowInfo.dateStr

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

  let availableStartTimes = []
  for (let h = 10; h < 19; h++) {
    for (let m of [0, 30]) {
      if (isToday) {
        if (h < nowInfo.nowHours || (h === nowInfo.nowHours && m <= nowInfo.nowMinutes)) {
          continue
        }
      }

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
    closed: false,
    available_slots: availableStartTimes.slice(0, 5),
    total_estimated_duration_minutes: reqDuration,
  }
}

async function bookAppointment({ services = [], date, time }, phone, name) {
  if (isClosedDay(date)) {
    return {
      error: "closed_on_sunday",
      message:
        "Fade & Blade Barbershop is closed on Sundays — please pick a date from Monday to Saturday.",
    }
  }

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

async function setPaymentMethod({ method }, phone) {
  const booking = await Booking.findOne({
    customerPhone: phone,
    status: { $ne: "cancelled" },
  }).sort({ _id: -1 })

  if (booking) {
    booking.payment_method = method
    if (method === "cash") {
      booking.payment_status = "unpaid"
    }
    await booking.save()
    return { success: true, booking_id: booking._id.toString(), method }
  }
  return { error: "No active booking found for this customer" }
}

async function modifyBooking({ booking_id, new_date, new_time }) {
  if (isClosedDay(new_date)) {
    return {
      error: "closed_on_sunday",
      message:
        "Fade & Blade Barbershop is closed on Sundays — please pick a date from Monday to Saturday.",
    }
  }

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

// Single dispatcher used both by real tool_calls AND by the pseudo
// function-call recovery path below, so behavior never diverges.
async function executeTool(toolName, args, phone, name) {
  if (toolName === "check_availability") return await checkAvailability(args)
  if (toolName === "book_appointment")
    return await bookAppointment(args, phone, name)
  if (toolName === "set_payment_method")
    return await setPaymentMethod(args, phone)
  if (toolName === "modify_booking") return await modifyBooking(args)
  if (toolName === "cancel_booking") return await cancelBooking(args)
  if (toolName === "lookup_customer_bookings")
    return await lookupCustomerBookings(args, phone)
  if (toolName === "log_conversation_event")
    return await logConversationEvent(args, phone)
  return { error: "unknown function" }
}

// --- PSEUDO FUNCTION-CALL RECOVERY ---
// Some Groq models (esp. the 8B fallback) occasionally ignore native
// tool-calling and instead write the call out as literal text, e.g.
//   <function=check_availability>{"date":"2026-07-25","services":[...]}</function>
// If that ever reaches the customer it looks like a bug/leak. We detect
// this pattern, execute the intended function ourselves, feed the result
// back to the model as context, and ask it to answer again in plain
// language — so the customer never sees raw code either way.
const FUNCTION_CALL_REGEX =
  /<function=([a-zA-Z_][a-zA-Z0-9_]*)>\s*(\{[\s\S]*?\})\s*<\/function>/g

function extractPseudoFunctionCalls(content) {
  if (!content || typeof content !== "string") return []
  const calls = []
  let match
  FUNCTION_CALL_REGEX.lastIndex = 0
  while ((match = FUNCTION_CALL_REGEX.exec(content)) !== null) {
    const [, name, argsRaw] = match
    let args = {}
    try {
      args = JSON.parse(argsRaw)
    } catch (e) {
      args = {}
    }
    calls.push({ name, args })
  }
  return calls
}

function stripFunctionCallSyntax(content) {
  if (!content || typeof content !== "string") return content
  return content.replace(FUNCTION_CALL_REGEX, "").trim()
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

  // Safety cap so a persistently misbehaving model can't loop forever.
  let guard = 0
  const MAX_TURNS = 6

  while (guard < MAX_TURNS) {
    guard++

    const hasRealToolCalls =
      responseMessage.tool_calls && responseMessage.tool_calls.length > 0
    const pseudoCalls = !hasRealToolCalls
      ? extractPseudoFunctionCalls(responseMessage.content)
      : []

    if (!hasRealToolCalls && pseudoCalls.length === 0) {
      // No tool intent detected at all — this is the final answer.
      break
    }

    // Always store a cleaned version of the assistant's turn so any stray
    // function-call text never persists into future context/history.
    const cleanedContent = stripFunctionCallSyntax(responseMessage.content)
    messages.push({ ...responseMessage, content: cleanedContent })

    if (hasRealToolCalls) {
      for (const toolCall of responseMessage.tool_calls) {
        const toolName = toolCall.function.name
        let args = {}
        try {
          args = JSON.parse(toolCall.function.arguments || "{}")
        } catch (e) {
          args = {}
        }

        const output = await executeTool(toolName, args, phone, name)

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name: toolName,
          content: JSON.stringify(output),
        })
      }
    } else {
      // Model wrote the call out as text instead of using real tool-calling.
      // Run the function ourselves and hand the result back as a system
      // note, instructing the model to respond in plain language only.
      for (const { name: toolName, args } of pseudoCalls) {
        const output = await executeTool(toolName, args, phone, name)
        messages.push({
          role: "system",
          content: `Tool result for ${toolName}: ${JSON.stringify(
            output,
          )}\nRespond to the customer now in plain, natural language only. Do not include any code, JSON, or function-call syntax in your reply.`,
        })
      }
    }

    response = await generateWithFailover(messages)
    responseMessage = response.choices[0].message
  }

  // Final safety net: strip any function-call syntax that might still be
  // present so it can never reach the customer, even if the loop above
  // hit its guard limit or missed an edge case.
  let finalText = stripFunctionCallSyntax(responseMessage.content || "")
  if (!finalText) {
    finalText =
      "Sorry, could you tell me again what date and time you'd like? I want to make sure I get you booked in correctly."
  }

  // Ensure the AI's final text answer is added to history for context retention
  messages.push({ ...responseMessage, content: finalText })

  return {
    replyText: finalText,
    updatedHistory: messages, // Passes the full native array back out to save in DB
  }
}
