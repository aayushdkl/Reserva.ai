import "./env.js"

import express from "express"
import cors from "cors"
import mongoose from "mongoose"
import pkg from "whatsapp-web.js"
import qrcode from "qrcode-terminal"
import {
  Conversation,
  Booking,
  BusinessConfig,
  ConversationEvent,
} from "./models.js"
import { runChat } from "./groq.js"
const { Client, LocalAuth } = pkg

const app = express()
app.use(cors())
app.use(express.json())

mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log("Mongo connected")
  if (!(await BusinessConfig.findOne())) {
    await BusinessConfig.create({})
  }
})

const waClient = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { args: ["--no-sandbox", "--disable-setuid-sandbox"] },
})

waClient.on("qr", (qr) => {
  console.log("Scan this QR code with WhatsApp (Linked Devices):")
  qrcode.generate(qr, { small: true })
})

waClient.on("ready", () => console.log("WhatsApp client is ready!"))

waClient.on("message", async (msg) => {
  try {
    if (msg.from.includes("@g.us") || msg.from === "status@broadcast") return

    const config = await BusinessConfig.findOne()
    if (config && config.manual_override) {
      console.log(
        `Ignoring message from ${msg.from} — Manual Override is active.`,
      )
      return
    }

    const phone = msg.from
    const body = msg.body
    const contact = await msg.getContact()
    const name = contact.pushname || phone

    let convo = await Conversation.findOne({ customerPhone: phone })
    if (!convo)
      convo = await Conversation.create({ customerPhone: phone, messages: [] })

    // Generate response using manual history building
    const { replyText, updatedHistory } = await runChat(
      phone,
      name,
      body,
      convo.messages,
    )

    // Save the entire updated history array back to Mongo natively
    await Conversation.findByIdAndUpdate(convo._id, {
      messages: updatedHistory,
    })

    await msg.reply(replyText)
  } catch (err) {
    console.error("WhatsApp message handling error:", err)
    try {
      await msg.reply(
        "Sorry, something went wrong on our end. We'll get back to you shortly.",
      )
    } catch {}
  }
})

waClient.initialize()

app.get("/api/bookings", async (req, res) => {
  res.json(await Booking.find().sort({ createdAt: -1 }))
})

app.get("/api/conversations", async (req, res) => {
  res.json(await Conversation.find().sort({ _id: -1 }))
})

app.get("/api/analytics", async (req, res) => {
  const events = await ConversationEvent.find()
  res.json({ total_events: events.length, data: events })
})
app.get("/api/config", async (req, res) => {
  const config = await BusinessConfig.findOne()
  if (!config) return res.status(404).json({ error: "No config found" })
  res.json(config)
})

app.put("/api/config", async (req, res) => {
  const config = await BusinessConfig.findOneAndUpdate({}, req.body, {
    new: true,
    upsert: true,
  })
  res.json(config)
})

app.listen(process.env.PORT || 5000, () =>
  console.log(`Server on ${process.env.PORT || 5000}`),
)
