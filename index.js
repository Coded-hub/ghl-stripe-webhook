import express from "express";
import Stripe from "stripe";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();
const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ✅ In-memory store for business info
const businessData = {};

// ✅ Middleware for all routes EXCEPT Stripe webhook
app.use((req, res, next) => {
  if (req.originalUrl === "/stripe-webhook") {
    next(); // Skip bodyParser here — handled below
  } else {
    bodyParser.json()(req, res, next);
  }
});

// ✅ Route 1: Receive business info from GHL
app.post("/save-business-info", (req, res) => {
  const { email, business_name, tax_id } = req.body.customData || req.body;
  if (!email) return res.status(400).send("Missing email field");

  businessData[email.toLowerCase()] = { business_name, tax_id };
  console.log("✅ Clean business data stored:", businessData[email.toLowerCase()]);
  return res.json({ success: true });
});

// ✅ Route 2: Stripe webhook (RAW BODY REQUIRED)
app.post(
  "/stripe-webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      // Verify raw body
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      console.log("✅ Stripe webhook verified:", event.type);
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Process successful payments
    if (event.type === "payment_intent.succeeded") 
     // Try to get email from payment intent first
let email = paymentIntent.receipt_email;

// ✅ If email is missing, try to retrieve it from the customer or charge
if (!email && paymentIntent.customer) {
  try {
    const customer = await stripe.customers.retrieve(paymentIntent.customer);
    email = customer.email;
  } catch (err) {
    console.log("⚠️ Could not retrieve customer:", err.message);
  }
}

if (!email && paymentIntent.latest_charge) {
  try {
    const charge = await stripe.charges.retrieve(paymentIntent.latest_charge);
    email = charge.billing_details.email;
  } catch (err) {
    console.log("⚠️ Could not retrieve charge:", err.message);
  }
}

if (!email) {
  console.log("⚠️ Missing email in payment intent and customer — skipping update.");
  return res.status(200).send("No email found, skipping update.");
}

console.log("✅ Email found:", email);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
