import { Router } from "express";
import { firestore, nextId, docToObj, nowTs } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import Razorpay from "razorpay";
import crypto from "crypto";

const router = Router();

async function getPaymentConfig() {
  const docSnap = await firestore.collection("settings").doc("payment").get();
  if (!docSnap.exists) {
    return { razorpayKeyId: "", razorpayKeySecret: "", webhookSecret: "" };
  }
  const data = docToObj(docSnap) as any;
  return {
    razorpayKeyId: data?.razorpayKeyId || "",
    razorpayKeySecret: data?.razorpayKeySecret || "",
    webhookSecret: data?.webhookSecret || "",
  };
}

async function getRazorpay() {
  const config = await getPaymentConfig();
  if (!config.razorpayKeyId || !config.razorpayKeySecret) {
    return null;
  }
  return new Razorpay({
    key_id: config.razorpayKeyId,
    key_secret: config.razorpayKeySecret,
  });
}

// ── GET /payments/config — Public/client config ──────────────────────────────
router.get("/payments/config", async (_req, res) => {
  try {
    const config = await getPaymentConfig();
    const isConfigured = Boolean(config.razorpayKeyId && config.razorpayKeySecret);
    res.json({
      razorpayKeyId: config.razorpayKeyId,
      isConfigured,
      currency: "INR",
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get payment config" });
  }
});

// ── POST /payments/test-keys — Test Razorpay Credentials ─────────────────────
router.post("/payments/test-keys", requireAuth, async (req, res) => {
  try {
    const { razorpayKeyId, razorpayKeySecret } = req.body;
    let keyId = razorpayKeyId;
    let keySecret = razorpayKeySecret;

    if (!keyId || !keySecret || keySecret.startsWith("********")) {
      const config = await getPaymentConfig();
      keyId = keyId || config.razorpayKeyId;
      keySecret = (keySecret && !keySecret.startsWith("********")) ? keySecret : config.razorpayKeySecret;
    }

    if (!keyId || !keySecret) {
      res.status(400).json({ success: false, message: "Key ID and Key Secret are required" });
      return;
    }

    const instance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    // Make a lightweight call to test authorization
    await instance.orders.all({ count: 1 });

    res.json({ success: true, message: "Razorpay connection successful! Keys are valid." });
  } catch (err: any) {
    const errorMessage = err?.error?.description || err?.message || "Failed to authenticate with Razorpay";
    res.status(400).json({ success: false, message: `Razorpay Error: ${errorMessage}` });
  }
});

// ── POST /payments/order — Create Razorpay Order ─────────────────────────────
router.post("/payments/order", requireAuth, async (req, res) => {
  try {
    const { planId } = req.body;
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const userId = user.userId || user.id || user.uid;
    const userEmail = user.email || "";

    const doc = await firestore.collection("plans").doc(String(planId)).get();
    const plan = docToObj(doc) as any;
    if (!plan) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }

    const config = await getPaymentConfig();
    if (!config.razorpayKeyId || !config.razorpayKeySecret) {
      res.status(500).json({ error: "Razorpay is not configured on the server" });
      return;
    }

    const razorpay = new Razorpay({
      key_id: config.razorpayKeyId,
      key_secret: config.razorpayKeySecret,
    });

    const price = Number(plan.price || 0);
    const amountInPaise = Math.round(price * 100);
    const receipt = `rcpt_${Date.now()}_${String(userId).slice(-4)}`;

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: receipt.slice(0, 40),
      notes: {
        planId: String(planId),
        planName: plan.name || "Plan Subscription",
        userId: String(userId),
        userEmail: userEmail,
      },
    });

    const orderId = await nextId("orders");
    const now = nowTs();
    await firestore.collection("orders").doc(String(orderId)).set({
      id: orderId,
      razorpayOrderId: order.id,
      userId: userId,
      userEmail: userEmail,
      planId: planId,
      planName: plan.name || "Plan Subscription",
      amount: price,
      currency: "INR",
      status: "created",
      receipt: order.receipt,
      createdAt: now,
      updatedAt: now,
    });

    res.status(201).json({
      id: order.id,
      orderId: order.id,
      amount: price,
      amountInPaise,
      currency: "INR",
      keyId: config.razorpayKeyId,
      plan: {
        id: plan.id,
        name: plan.name,
        questionLimit: plan.questionLimit,
        durationDays: plan.durationDays,
      },
    });
  } catch (err: any) {
    req.log?.error?.({ err }, "Create order error");
    res.status(500).json({ error: err?.message || "Failed to create payment order" });
  }
});

// ── POST /payments/verify — Verify Razorpay Payment & Activate Plan ───────────
router.post("/payments/verify", requireAuth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const user = (req as any).user;
    const userId = user?.userId || user?.id || user?.uid;

    const config = await getPaymentConfig();
    if (!config.razorpayKeySecret) {
      res.status(500).json({ error: "Payment configuration is missing", success: false });
      return;
    }

    const hmac = crypto.createHmac("sha256", config.razorpayKeySecret);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== razorpay_signature) {
      res.status(400).json({ error: "Invalid payment signature", success: false });
      return;
    }

    // Find the order
    const snap = await firestore.collection("orders").where("razorpayOrderId", "==", razorpay_order_id).limit(1).get();
    if (snap.empty) {
      res.status(404).json({ error: "Order not found", success: false });
      return;
    }

    const orderDoc = snap.docs[0];
    const orderData = docToObj(orderDoc) as any;
    const now = nowTs();

    // 1. Update order status to paid
    await orderDoc.ref.update({
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      status: "paid",
      paidAt: now,
      updatedAt: now,
    });

    // 2. Fetch the plan details to activate subscription
    const targetUserId = orderData.userId || userId;
    const planId = orderData.planId;

    if (planId && targetUserId) {
      const planDoc = await firestore.collection("plans").doc(String(planId)).get();
      const plan = docToObj(planDoc) as any;

      let expireAt: any = null;
      if (plan?.durationDays && Number(plan.durationDays) > 0) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + Number(plan.durationDays));
        expireAt = expiryDate.toISOString();
      }

      // Check if user already has a user_plans entry
      const existingUserPlansSnap = await firestore
        .collection("user_plans")
        .where("userId", "==", targetUserId)
        .limit(1)
        .get();

      if (!existingUserPlansSnap.empty) {
        const upDoc = existingUserPlansSnap.docs[0];
        await upDoc.ref.update({
          planId: planId,
          planName: plan?.name || "Plan Subscription",
          questionLimit: plan?.questionLimit || 100,
          isActive: true,
          activatedAt: now,
          expireAt: expireAt,
          updatedAt: now,
        });
      } else {
        const userPlanId = await nextId("user_plans");
        await firestore.collection("user_plans").doc(String(userPlanId)).set({
          id: userPlanId,
          userId: targetUserId,
          planId: planId,
          planName: plan?.name || "Plan Subscription",
          questionLimit: plan?.questionLimit || 100,
          questionsUsed: 0,
          isActive: true,
          activatedAt: now,
          expireAt: expireAt,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Also update user's profile if present in `users` collection
      const userDocRef = firestore.collection("users").doc(String(targetUserId));
      const userDocSnap = await userDocRef.get();
      if (userDocSnap.exists) {
        await userDocRef.update({
          activePlanId: planId,
          activePlanName: plan?.name || "Active Plan",
          updatedAt: now,
        });
      }
    }

    res.json({
      success: true,
      message: "Payment verified successfully! Your subscription has been activated.",
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
    });
  } catch (err: any) {
    req.log?.error?.({ err }, "Verify payment error");
    res.status(500).json({ error: err?.message || "Failed to verify payment", success: false });
  }
});

// ── GET /payments/status & /payments/my-subscription — Check Plan Purchase Done ───
router.get(["/payments/status", "/payments/my-subscription", "/payments/subscription"], requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const callerId = user?.userId || user?.id || user?.uid;
    const role = user?.role || "student";

    // Allow admins to inspect a specific student's subscription via ?userId=
    const queryUserId = req.query["userId"] ? Number(req.query["userId"]) : null;
    const targetUserId = (role === "admin" || role === "superadmin") && queryUserId ? queryUserId : callerId;

    if (!targetUserId) {
      res.status(400).json({ error: "User ID not identified", hasActivePlan: false });
      return;
    }

    // 1. Check user_plans collection
    const upSnap = await firestore.collection("user_plans").where("userId", "==", targetUserId).limit(1).get();
    let userPlan: any = null;
    if (!upSnap.empty) {
      userPlan = docToObj(upSnap.docs[0]);
    }

    // 2. Check most recent paid order
    const ordersSnap = await firestore
      .collection("orders")
      .where("userId", "==", targetUserId)
      .where("status", "==", "paid")
      .get();

    const paidOrders = ordersSnap.docs
      .map((d) => ({ id: d.id, ...docToObj(d) }))
      .sort((a: any, b: any) => {
        const timeA = a.paidAt?._seconds ? a.paidAt._seconds * 1000 : new Date(a.paidAt || a.createdAt || 0).getTime();
        const timeB = b.paidAt?._seconds ? b.paidAt._seconds * 1000 : new Date(b.paidAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      });

    const lastPaidOrder: any = paidOrders[0] || null;

    // 3. Determine active status and expiry
    let hasActivePlan = false;
    let isExpired = false;
    let daysRemaining = 0;
    let expireAtDate: Date | null = null;

    if (userPlan && userPlan.isActive) {
      if (userPlan.expireAt) {
        expireAtDate = new Date(userPlan.expireAt);
        const now = new Date();
        if (expireAtDate < now) {
          isExpired = true;
          hasActivePlan = false;
          daysRemaining = 0;
        } else {
          isExpired = false;
          hasActivePlan = true;
          daysRemaining = Math.max(0, Math.ceil((expireAtDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        }
      } else {
        // Lifetime / non-expiring
        hasActivePlan = true;
        isExpired = false;
        daysRemaining = 9999;
      }
    } else if (lastPaidOrder) {
      // Fallback: order was paid but user_plan not created
      hasActivePlan = true;
      isExpired = false;
      daysRemaining = 30;
    }

    const questionLimit = Number(userPlan?.questionLimit || lastPaidOrder?.plan?.questionLimit || 100);
    const questionsUsed = Number(userPlan?.questionsUsed || 0);
    const questionsRemaining = Math.max(0, questionLimit - questionsUsed);

    res.json({
      hasActivePlan,
      isPurchaseDone: Boolean(lastPaidOrder || (userPlan && userPlan.isActive)),
      isExpired,
      daysRemaining,
      subscription: userPlan || lastPaidOrder ? {
        planId: userPlan?.planId || lastPaidOrder?.planId || null,
        planName: userPlan?.planName || lastPaidOrder?.planName || "Active Subscription",
        questionLimit,
        questionsUsed,
        questionsRemaining,
        isActive: hasActivePlan,
        isExpired,
        daysRemaining,
        activatedAt: userPlan?.activatedAt || lastPaidOrder?.paidAt || null,
        expireAt: userPlan?.expireAt || null,
      } : null,
      lastOrder: lastPaidOrder ? {
        orderId: lastPaidOrder.razorpayOrderId || lastPaidOrder.id,
        paymentId: lastPaidOrder.razorpayPaymentId || null,
        amount: lastPaidOrder.amount,
        currency: lastPaidOrder.currency || "INR",
        status: lastPaidOrder.status,
        planName: lastPaidOrder.planName,
        paidAt: lastPaidOrder.paidAt || lastPaidOrder.createdAt,
      } : null,
      totalPaidOrders: paidOrders.length,
    });
  } catch (err: any) {
    req.log?.error?.({ err }, "Fetch subscription status error");
    res.status(500).json({ error: err?.message || "Failed to check subscription status", hasActivePlan: false });
  }
});

// ── GET /payments/history — Transaction History ──────────────────────────────
router.get("/payments/history", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const userId = user?.userId || user?.id || user?.uid;
    const role = user?.role || "student";

    let query: FirebaseFirestore.Query = firestore.collection("orders");

    // If student, filter by their own userId
    if (role !== "admin" && role !== "superadmin") {
      query = query.where("userId", "==", userId);
    }

    const snap = await query.get();
    const orders = snap.docs
      .map((d) => ({ id: d.id, ...docToObj(d) }))
      .sort((a: any, b: any) => {
        const timeA = a.createdAt?._seconds ? a.createdAt._seconds * 1000 : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?._seconds ? b.createdAt._seconds * 1000 : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });

    res.json({ data: orders });
  } catch (err: any) {
    req.log?.error?.({ err }, "Fetch payment history error");
    res.status(500).json({ error: "Failed to fetch payment history" });
  }
});

// ── POST /payments/webhook — Razorpay Webhook Handler ─────────────────────────
router.post("/payments/webhook", async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"] as string;
    const config = await getPaymentConfig();

    if (config.webhookSecret && signature) {
      const shasum = crypto.createHmac("sha256", config.webhookSecret);
      shasum.update(JSON.stringify(req.body));
      const digest = shasum.digest("hex");

      if (digest !== signature) {
        res.status(400).json({ error: "Invalid webhook signature" });
        return;
      }
    }

    const event = req.body.event;
    const payload = req.body.payload;

    if (event === "payment.captured" || event === "order.paid") {
      const paymentEntity = payload?.payment?.entity;
      const orderId = paymentEntity?.order_id || payload?.order?.entity?.id;

      if (orderId) {
        const snap = await firestore.collection("orders").where("razorpayOrderId", "==", orderId).limit(1).get();
        if (!snap.empty) {
          const orderDoc = snap.docs[0];
          const orderData = docToObj(orderDoc) as any;
          if (orderData.status !== "paid") {
            const now = nowTs();
            await orderDoc.ref.update({
              status: "paid",
              razorpayPaymentId: paymentEntity?.id || "webhook_captured",
              paidAt: now,
              updatedAt: now,
            });
          }
        }
      }
    }

    res.json({ status: "ok" });
  } catch (err: any) {
    res.status(500).json({ error: "Webhook processing error" });
  }
});

export const paymentsRouter = router;
