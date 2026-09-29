import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { firestore, docToObj } from "@workspace/db";

const router = Router();

router.get("/settings/payment", requireAuth, async (req, res) => {
  try {
    const docSnap = await firestore.collection("settings").doc("payment").get();
    if (!docSnap.exists) {
      res.json({
        razorpayKeyId: "",
        razorpayKeySecret: "",
        webhookSecret: "",
        testAccountEmail: "",
        testAccountPassword: "",
      });
      return;
    }
    const data = docToObj(docSnap) as any;
    
    // Partially mask secrets for security when sending to frontend
    let maskedSecret = "";
    if (data?.razorpayKeySecret && data.razorpayKeySecret.length > 4) {
      maskedSecret = "********" + data.razorpayKeySecret.slice(-4);
    }

    let maskedWebhookSecret = "";
    if (data?.webhookSecret && data.webhookSecret.length > 4) {
      maskedWebhookSecret = "********" + data.webhookSecret.slice(-4);
    }

    res.json({
      razorpayKeyId: data?.razorpayKeyId || "",
      razorpayKeySecret: maskedSecret,
      webhookSecret: maskedWebhookSecret,
      testAccountEmail: data?.testAccountEmail || "",
      testAccountPassword: data?.testAccountPassword || "",
    });
  } catch (error) {
    console.error("Error fetching payment settings:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/settings/payment", requireAuth, async (req, res) => {
  try {
    const {
      razorpayKeyId,
      razorpayKeySecret,
      webhookSecret,
      testAccountEmail,
      testAccountPassword,
    } = req.body;
    
    const docRef = firestore.collection("settings").doc("payment");
    const docSnap = await docRef.get();
    const existing = docSnap.exists ? docSnap.data() : {};
    
    const updates: any = {
      razorpayKeyId: razorpayKeyId ?? "",
      testAccountEmail: testAccountEmail ?? "",
      testAccountPassword: testAccountPassword ?? "",
    };
    
    // Only update the secret if it's not the masked string
    if (razorpayKeySecret && !razorpayKeySecret.startsWith("********")) {
      updates.razorpayKeySecret = razorpayKeySecret;
    } else if (razorpayKeySecret === "") {
      updates.razorpayKeySecret = "";
    } else if (existing?.razorpayKeySecret) {
      updates.razorpayKeySecret = existing.razorpayKeySecret;
    }

    if (webhookSecret && !webhookSecret.startsWith("********")) {
      updates.webhookSecret = webhookSecret;
    } else if (webhookSecret === "") {
      updates.webhookSecret = "";
    } else if (existing?.webhookSecret) {
      updates.webhookSecret = existing.webhookSecret;
    }
    
    await docRef.set(updates, { merge: true });
    
    res.json({
      razorpayKeyId: updates.razorpayKeyId,
      razorpayKeySecret: updates.razorpayKeySecret ? "********" + updates.razorpayKeySecret.slice(-4) : "",
      webhookSecret: updates.webhookSecret ? "********" + updates.webhookSecret.slice(-4) : "",
      testAccountEmail: updates.testAccountEmail,
      testAccountPassword: updates.testAccountPassword,
    });
  } catch (error) {
    console.error("Error saving payment settings:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Also create public config endpoint for student app/portal if needed
router.get("/settings/public-payment", async (_req, res) => {
  try {
    const docSnap = await firestore.collection("settings").doc("payment").get();
    if (!docSnap.exists) {
      res.json({ razorpayKeyId: "", isConfigured: false, testAccountEmail: "" });
      return;
    }
    const data = docToObj(docSnap) as any;
    res.json({
      razorpayKeyId: data?.razorpayKeyId || "",
      isConfigured: Boolean(data?.razorpayKeyId && data?.razorpayKeySecret),
      testAccountEmail: data?.testAccountEmail || "",
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
