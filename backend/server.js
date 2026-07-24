import "./env.js"

import express from "express"
import cors from "cors"
import mongoose from "mongoose"
import pkg from "whatsapp-web.js"
import qrcodeTerminal from "qrcode-terminal"
import QRCode from "qrcode"
import os from "os"
import fs from "fs"
import {
  Conversation,
  Booking,
  BusinessConfig,
  ConversationEvent,
} from "./models.js"
import { runChat } from "./groq.js"
const { Client, LocalAuth, MessageMedia } = pkg

const app = express()
app.use(cors())
app.use(express.json())

function getLocalIp() {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address
      }
    }
  }
  return "localhost"
}

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
  qrcodeTerminal.generate(qr, { small: true })
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

    let cleanReplyText = replyText
    let shouldSendQR = false

    if (replyText.includes("[SEND_PAYMENT_QR]")) {
      shouldSendQR = true
      cleanReplyText = replyText.replace(/\[SEND_PAYMENT_QR\]/g, "").trim()
    }

    if (cleanReplyText) {
      await msg.reply(cleanReplyText)
    }

    if (shouldSendQR) {
      try {
        const booking = await Booking.findOne({
          customerPhone: phone,
          status: { $ne: "cancelled" },
        }).sort({ _id: -1 })

        const host = process.env.PAYMENT_HOST || getLocalIp()
        const port = process.env.PORT || 5000
        const bookingIdStr = booking ? booking._id.toString() : "demo"
        const payUrl = `http://${host}:${port}/pay/${bookingIdStr}`

        console.log(`[QR Payment Generator] Unique payment link: ${payUrl}`)

        const qrBuffer = await QRCode.toBuffer(payUrl, {
          width: 350,
          margin: 2,
          color: { dark: "#000000", light: "#ffffff" },
        })

        const media = new MessageMedia(
          "image/png",
          qrBuffer.toString("base64"),
          `payment-qr-${bookingIdStr}.png`,
        )

        await waClient.sendMessage(msg.from, media, {
          caption: `📲 *Fade & Blade Barbershop Payment QR*\nScan this QR code with any phone camera/scanner to complete payment of Rs. ${booking ? booking.price : "total"}!`,
        })
      } catch (qrErr) {
        console.error("Error sending dynamic QR image via WhatsApp:", qrErr)
      }
    }
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

// --- REAL-TIME SCAN-TO-PAY ENDPOINT ---
app.get("/pay/:bookingId", async (req, res) => {
  try {
    const { bookingId } = req.params
    let booking

    if (bookingId === "demo") {
      booking = {
        customerName: "Demo Customer",
        services: ["Classic Scissor Cut"],
        date: new Date().toISOString().split("T")[0],
        time: "14:00",
        price: 500,
      }
    } else {
      booking = await Booking.findById(bookingId)
      if (!booking) {
        return res.status(404).send("<h1 style='color:white;text-align:center;font-family:sans-serif;'>Booking not found</h1>")
      }
      booking.payment_status = "paid"
      booking.payment_method = "online"
      await booking.save()

      // Notify customer on WhatsApp if client is active
      if (waClient && booking.customerPhone) {
        try {
          await waClient.sendMessage(
            booking.customerPhone,
            `✅ *Payment Confirmed!*\nWe have received your online payment of Rs. ${booking.price} for your booking on ${booking.date} at ${booking.time}. Thank you!`,
          )
        } catch (waErr) {
          console.error("Failed to send WhatsApp payment confirmation message:", waErr)
        }
      }
    }

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Successful — Reserva.ai</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #0f172a;
            color: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
          }
          .card {
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 24px;
            padding: 36px 24px;
            max-width: 420px;
            width: 100%;
            text-align: center;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
          }
          .checkmark {
            width: 84px;
            height: 84px;
            background: rgba(16, 185, 129, 0.15);
            color: #10b981;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 44px;
            margin: 0 auto 24px auto;
            border: 2px solid #10b981;
          }
          h1 { font-size: 26px; color: #10b981; margin-bottom: 8px; font-weight: 700; }
          p { color: #94a3b8; font-size: 15px; margin-bottom: 28px; line-height: 1.5; }
          .details {
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 14px;
            padding: 18px;
            text-align: left;
          }
          .row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #1e293b;
            font-size: 14px;
          }
          .row:last-child { border-bottom: none; }
          .label { color: #64748b; }
          .val { font-weight: 600; color: #f1f5f9; }
          .badge {
            background: #064e3b;
            color: #34d399;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.5px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="checkmark">✓</div>
          <h1>Payment Confirmed!</h1>
          <p>Your payment has been verified and your booking status is updated live.</p>
          <div class="details">
            <div class="row">
              <span class="label">Customer</span>
              <span class="val">${booking.customerName || "Walk-in"}</span>
            </div>
            <div class="row">
              <span class="label">Service</span>
              <span class="val">${Array.isArray(booking.services) ? booking.services.join(", ") : booking.services}</span>
            </div>
            <div class="row">
              <span class="label">Schedule</span>
              <span class="val">${booking.date} at ${booking.time}</span>
            </div>
            <div class="row">
              <span class="label">Amount Paid</span>
              <span class="val" style="color: #10b981;">Rs. ${booking.price}</span>
            </div>
            <div class="row">
              <span class="label">Payment Status</span>
              <span class="val"><span class="badge">PAID</span></span>
            </div>
          </div>
        </div>
      </body>
      </html>
    `)
  } catch (err) {
    console.error("Payment scanner route error:", err)
    res.status(500).send("<h1 style='color:white;text-align:center;'>Payment processing error</h1>")
  }
})

app.get("/api/bookings", async (req, res) => {
  res.json(await Booking.find().sort({ createdAt: -1 }))
})

app.patch("/api/bookings/:id/payment", async (req, res) => {
  const { payment_status } = req.body
  const booking = await Booking.findByIdAndUpdate(
    req.params.id,
    { payment_status },
    { new: true },
  )
  if (!booking) return res.status(404).json({ error: "Booking not found" })
  res.json(booking)
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


