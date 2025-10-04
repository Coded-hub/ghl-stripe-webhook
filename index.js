import express from "express";
import Stripe from "stripe";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();
const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// 🧠 In-memory store for form submissions (email → business info)
const businessDataStore = {};

// ✅ Capture raw body for Stripe signature verification
app.use(
  express.json({
    verify: (req, res, buf) => {
      if (req.originalUrl.startsWith("/stripe-webhook")) {
        req.rawBody = buf;
      }
    },
  })
);

// ✅ Simple route check
app.get("/", (req, res) => {
  res.send("✅ Stripe ↔ GHL Webhook Server is live!");
});

//
// ---------------------------------------------------------------------------
// 1️⃣ GHL → /save-business-info
// ---------------------------------------------------------------------------
app.post("/save-business-info", async (req, res) => {
  try {
    const { email, business_name, tax_id } = req.body;

    if (!email || !business_name || !tax_id) {
      console.log("❌ Missing one or more required fields", req.body);
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    const normalizedEmail = email.toLowerCase();
    businessDataStore[normalizedEmail] = { business_name, tax_id };

    console.log(`✅ Business info stored for ${normalizedEmail}:`, {
      business_name,
      tax_id,
    });

    console.log("🧾 Current saved customers:", businessDataStore);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error saving business info:", err);
    res.status(500).json({ success: false });
  }
});

//
// ---------------------------------------------------------------------------
// 2️⃣ Stripe → /stripe-webhook
// ---------------------------------------------------------------------------
app.post("/stripe-webhook", bodyParser.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    console.log(`✅ Stripe webhook verified: ${event.type}`);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;
    const customerId = paymentIntent.customer;
    const customerEmail = paymentIntent.receipt_email?.toLowerCase();

    if (!customerEmail) {
      console.log("⚠️ Missing email in payment intent and customer — skipping update.");
      return res.status(200).json({ received: true });
    }

    console.log(`✅ Email found: ${customerEmail}`);

    const businessData = businessDataStore[customerEmail];
    if (!businessData) {
      console.log(`⚠️ No business data found for ${customerEmail}`);
      return res.status(200).json({ received: true });
    }

    const { business_name, tax_id } = businessData;
    console.log(`✅ Found business data for ${customerEmail}:`, businessData);

    // ✅ Update Stripe customer
    stripe.customers
      .update(customerId, { name: business_name })
      .then(() =>
        stripe.customers.createTaxId(customerId, {
          type: "eu_vat", // or "us_ein" depending on your client region
          value: tax_id,
        })
      )
      .then(() => console.log(`✅ Stripe customer updated successfully for ${customerEmail}`))
      .catch((err) => console.error("❌ Stripe customer update error:", err.message));
  }

  res.json({ received: true });
});

//
// ---------------------------------------------------------------------------
// 3️⃣ GHL Automation Relay (optional)
// ---------------------------------------------------------------------------
app.post("/ghl-webhook", async (req, res) => {
  try {
    const { email } = req.body;
    console.log("📩 GHL webhook received:", req.body);

    // Example: trigger automation in GHL if needed
    if (email) {
      await axios.post(process.env.GHL_AUTOMATION_URL, { email });
      console.log(`✅ Forwarded automation trigger for ${email}`);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error in GHL relay:", err);
    res.status(500).json({ success: false });
  }
});

//
// ---------------------------------------------------------------------------
// 🚀 Server
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
