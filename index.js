import express from "express";
import bodyParser from "body-parser";
import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
const PORT = process.env.PORT || 10000;

// ✅ Temporary store for form submissions
let formSubmissions = {};

// -------------------
// 🧩 GHL → Save form data
// -------------------
app.post("/save-business-info", bodyParser.json(), (req, res) => {
  console.log("📦 Full webhook body received:", JSON.stringify(req.body, null, 2));

  // Extract from customData (actual payload structure)
  const { customData } = req.body || {};
  const email = customData?.email;
  const business_name = customData?.business_name;
  const tax_id = customData?.tax_id;

  console.log("✅ Extracted from customData:", { email, business_name, tax_id });

  if (email) {
    formSubmissions[email] = { business_name, tax_id };
    console.log(`💾 Saved form data for ${email}`, formSubmissions[email]);
    res.json({ success: true });
  } else {
    res.status(400).json({ error: "Missing email field in form submission" });
  }
});

// -------------------
// 💳 Stripe Webhook
// -------------------
app.post(
  "/stripe-webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error("❌ Stripe signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      const email = paymentIntent.receipt_email;

      console.log("💳 Payment received for:", email);

      const formData = formSubmissions[email];
      if (formData) {
        console.log("🧾 Matched form data:", formData);
        console.log(`✅ Combined record for ${email}:`, {
          ...formData,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
        });

        // 👉 Optionally, send this data to Oblio or update Stripe Customer here
      } else {
        console.warn("⚠️ No matching form submission found for:", email);
      }
    }

    res.sendStatus(200);
  }
);

// -------------------
app.get("/", (req, res) => {
  res.send("🚀 Webhook server is live and running.");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
