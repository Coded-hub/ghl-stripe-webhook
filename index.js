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
import express from "express";
const app = express();
app.use(express.json());

const businessDataStore = {};

app.post("/save-business-info", async (req, res) => {
  try {
    const body = req.body;

    // Extract just the fields we care about
    const email =
      body?.email ||
      body?.["email address"] ||
      body?.customData?.email;

    const business_name =
      body?.["Business Name"] ||
      body?.["business_name"] ||
      body?.customData?.business_name;

    const tax_id =
      body?.["Tax-ID (VAT/CUI)"] ||
      body?.["tax_id"] ||
      body?.customData?.tax_id;

    if (!email || !business_name || !tax_id) {
      console.log("⚠️ Missing fields:", { email, business_name, tax_id });
      return res.status(400).json({
        error: "Missing one or more required fields (email, business_name, tax_id)",
        received: { email, business_name, tax_id },
      });
    }

    // Store it in memory (you can replace this with a database if needed)
    businessDataStore[email.toLowerCase()] = { business_name, tax_id };

    console.log("✅ Clean business data stored:", businessDataStore[email.toLowerCase()]);

    res.status(200).json({
      message: "Business info stored successfully",
      stored: businessDataStore[email.toLowerCase()],
    });
  } catch (error) {
    console.error("❌ Error saving business info:", error);
    res.status(500).json({ error: "Internal Server Error" });
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
