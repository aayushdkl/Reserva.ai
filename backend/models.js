import mongoose from "mongoose"

const bookingSchema = new mongoose.Schema({
  customerName: String,
  customerPhone: String,
  services: [String],
  date: String, // YYYY-MM-DD
  time: String, // HH:MM
  duration: Number, // Total duration in minutes
  price: Number, // Total price
  status: { type: String, default: "confirmed" },
  payment_status: { type: String, default: "unpaid" },
  createdAt: { type: Date, default: Date.now },
})

const conversationSchema = new mongoose.Schema({
  customerPhone: String,
  messages: [mongoose.Schema.Types.Mixed], // Changed to Mixed to natively support Groq message formatting (content, tool_calls, etc.)
})

const businessConfigSchema = new mongoose.Schema({
  services: { type: Array, default: [] },
  daily_hours: { type: Array, default: [] },
  blocked_ranges: { type: Array, default: [] },
  recurring_closed: { type: Array, default: [0] },
  daily_customer_cap: { type: Number, default: null },
  buffer_minutes: { type: Number, default: 10 },
  manual_override: { type: Boolean, default: false },
  approve_before_confirm: { type: Boolean, default: false },
  enable_negotiation: { type: Boolean, default: false },
  message_handoff_limit: { type: Number, default: 20 },
})
const conversationEventSchema = new mongoose.Schema({
  customerPhone: String,
  event_type: String,
  metadata: mongoose.Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now },
})

export const Booking = mongoose.model("Booking", bookingSchema)
export const Conversation = mongoose.model("Conversation", conversationSchema)
export const BusinessConfig = mongoose.model(
  "BusinessConfig",
  businessConfigSchema,
)
export const ConversationEvent = mongoose.model(
  "ConversationEvent",
  conversationEventSchema,
)
