import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { firestore, docToObj } from "@workspace/db";

const router = Router();

router.get("/payment", requireAuth, async (req, res) => {
  try {
    const docSnap = await firestore.collection("settings").doc("payment").get();
    if (!docSnap.exists) {
      res.json({ razorpayKeyId: "", razorpayKeySecret: "" });
      return;
    }
    const data = docToObj(docSnap) as any;
    
    // Partially mask the secret for security when sending to frontend
    let maskedSecret = "";
    if (data?.razorpayKeySecret && data.razorpayKeySecret.length > 4) {
      maskedSecret = "********" + data.razorpayKeySecret.slice(-4);
    }

    res.json({
      razorpayKeyId: data?.razorpayKeyId || "",
      razorpayKeySecret: maskedSecret
    });
  } catch (error) {
    console.error("Error fetching payment settings:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/payment", requireAuth, async (req, res) => {
  try {
    const { razorpayKeyId, razorpayKeySecret } = req.body;
    
    const docRef = firestore.collection("settings").doc("payment");
    const docSnap = await docRef.get();
    
    const updates: any = { razorpayKeyId };
    
    // Only update the secret if it's not the masked string
    if (razorpayKeySecret && !razorpayKeySecret.startsWith("********")) {
      updates.razorpayKeySecret = razorpayKeySecret;
    } else if (!razorpayKeySecret) {
      updates.razorpayKeySecret = "";
    }
    
    await docRef.set(updates, { merge: true });
    
    res.json({
      razorpayKeyId: updates.razorpayKeyId,
      razorpayKeySecret: updates.razorpayKeySecret ? "********" + updates.razorpayKeySecret.slice(-4) : ""
    });
  } catch (error) {
    console.error("Error saving payment settings:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
