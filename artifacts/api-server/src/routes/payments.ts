import { Router } from "express";
import { firestore, nextId, docToObj, nowTs } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import Razorpay from "razorpay";
import crypto from "crypto";

const router = Router();

async function getRazorpay() {
  const docSnap = await firestore.collection("settings").doc("payment").get();
  if (!docSnap.exists) {
    return null;
  }
  const data = docToObj(docSnap) as any;
  if (!data?.razorpayKeyId || !data?.razorpayKeySecret) {
    return null;
  }
  return new Razorpay({
    key_id: data.razorpayKeyId,
    key_secret: data.razorpayKeySecret,
  });
}

async function getRazorpaySecret() {
  const docSnap = await firestore.collection("settings").doc("payment").get();
  if (!docSnap.exists) {
    return null;
  }
  const data = docToObj(docSnap) as any;
  return data?.razorpayKeySecret || null;
}

router.post("/order", requireAuth, async (req, res) => {
  try {
    const { planId } = req.body;
    // req.user is populated by requireAuth, but we don't have types here for it unless we cast
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    
    const doc = await firestore.collection("plans").doc(String(planId)).get();
    const plan = docToObj(doc);
    if (!plan) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }

    const razorpay = await getRazorpay();
    if (!razorpay) {
      res.status(500).json({ error: "Payment configuration is missing" });
      return;
    }

    const price = Number(plan.price || 0);
    const amountInPaise = Math.round(price * 100);
    const receipt = `receipt_order_${Date.now()}`;

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: receipt,
    });

    const orderId = await nextId("orders");
    const now = nowTs();
    await firestore.collection("orders").doc(String(orderId)).set({
      id: orderId,
      razorpayOrderId: order.id,
      userId: user.id,
      planId,
      amount: price,
      currency: "INR",
      status: "created",
      receipt,
      createdAt: now,
      updatedAt: now,
    });

    res.status(201).json({
      id: order.id,
      amount: price,
      currency: "INR",
    });
  } catch (err) {
    req.log.error({ err }, "Create order error");
    res.status(500).json({ error: "Failed to create order" });
  }
});

router.post("/verify", requireAuth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const secret = await getRazorpaySecret();
    if (!secret) {
      res.status(500).json({ error: "Payment configuration is missing", success: false });
      return;
    }
    
    const hmac = crypto.createHmac("sha256", secret as string);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== razorpay_signature) {
      res.status(400).json({ error: "Invalid signature", success: false });
      return;
    }

    // Find the order
    const snap = await firestore.collection("orders").where("razorpayOrderId", "==", razorpay_order_id).limit(1).get();
    if (snap.empty) {
      res.status(404).json({ error: "Order not found", success: false });
      return;
    }
    
    const orderDoc = snap.docs[0];
    await orderDoc.ref.update({
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      status: "paid",
      updatedAt: nowTs(),
    });

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Verify payment error");
    res.status(500).json({ error: "Failed to verify payment", success: false });
  }
});

export const paymentsRouter = router;
