import express from "express";
import bodyParser from "body-parser";
import Stripe from "stripe";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// ✅ Stripe setup
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ✅ Parse raw body for Stripe webhook
app.post(
  "/stripe-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      console.log("✅ Stripe webhook verified:", event.type);
    } catch (err) {
      console.error("❌ Webhook verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle successful payment
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      const email =
        paymentIntent.receipt_email ||
        paymentIntent.customer_email ||
        paymentIntent.metadata?.email;
      const businessName = paymentIntent.metadata?.business_name;
      const contactId = paymentIntent.metadata?.contact_id;

      console.log("✅ Email found:", email || "None");
      console.log("✅ Business name:", businessName || "None");
      console.log("✅ Contact ID:", contactId || "None");

      // Check if we have enough info to proceed
      if (!email || !contactId) {
        console.warn("⚠️ Missing one or more required fields");
        return res.status(200).json({ received: true });
      }

      try {
        // ✅ Send update directly to GHL API
        const ghlUrl = `https://services.leadconnectorhq.com/v1/contacts/${contactId}`;

        const updateData = {
          email,
          customField: {
            business_name: businessName || "Unknown Business",
          },
          tags: ["Paid"],
        };

        const response = await axios.put(ghlUrl, updateData, {
          headers: {
            Authorization: `Bearer ${process.env.GHL_API_KEY}`,
            Version: "2021-07-28",
            "Content-Type": "application/json",
          },
        });

        console.log("✅ Successfully updated contact in GHL:", response.status);
      } catch (error) {
        console.error(
          "❌ Failed to update contact in GHL:",
          error.response?.data || error.message
        );
      }
    }

    res.json({ received: true });
  }
);

// ✅ Body parser for non-Stripe routes
app.use(bodyParser.json());

// ✅ GHL form webhook (incoming from GHL form submissions)
app.post("/ghl-webhook", async (req, res) => {
    console.log("✅ Received form submission from GHL:", req.body);

    try {
        const { email, contact_id, business_name } = req.body;

        if (!email || !contact_id) {
            console.warn("⚠️ Missing email or contact_id in GHL submission");
            return res.status(200).json({ received: true });
        }

        console.log("✅ Saving business data for later use...");

        // You can store this temporarily (e.g. in-memory for now)
        // Later, you can connect a DB like Mongo or Redis if needed
        // For now, just log it
        console.log({ email, contact_id, business_name });

        res.json({ success: true });
    } catch (error) {
        console.error("❌ Error processing GHL webhook:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
