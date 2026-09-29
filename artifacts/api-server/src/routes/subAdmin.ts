import { Router } from "express";
import bcrypt from "bcryptjs";
import { firestore, docToObj, snapshotToArr, nextId, nowTs } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import { logActivity } from "../lib/audit.js";

const router = Router();

// Middleware: ensure caller is superadmin or admin
function requireSuperAdmin(req: any, res: any, next: any) {
  const user = req.user;
  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    return res.status(403).json({ error: "Access denied. Super Admin privileges required." });
  }
  next();
}

// ─── 1. List all Sub-Admins ──────────────────────────────────────────────────
router.get("/subadmins", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const snap = await firestore.collection("users").where("role", "==", "subadmin").get();
    const subadmins = snapshotToArr(snap).map((u: any) => ({
      id: u.id,
      name: u.name || "",
      email: u.email || "",
      role: u.role,
      permissions: Array.isArray(u.permissions) ? u.permissions : [],
      isActive: u.isActive !== false,
      createdById: u.createdById || null,
      createdAt: u.createdAt || null,
      updatedAt: u.updatedAt || null,
    }));

    res.json({ subadmins, count: subadmins.length });
  } catch (err: any) {
    req.log?.error?.({ err }, "List subadmins error");
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ─── 2. Create a Sub-Admin ───────────────────────────────────────────────────
router.post("/subadmins", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const caller = (req as any).user;
    const { name, email, password, permissions = [] } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingSnap = await firestore.collection("users").where("email", "==", cleanEmail).limit(1).get();
    if (!existingSnap.empty) {
      return res.status(400).json({ error: "A user with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = await nextId("users");
    const now = nowTs();

    const newSubAdmin = {
      id: userId,
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      role: "subadmin",
      permissions: Array.isArray(permissions) ? permissions : [],
      isActive: true,
      createdById: caller.userId,
      createdAt: now,
      updatedAt: now,
    };

    await firestore.collection("users").doc(String(userId)).set(newSubAdmin);

    await logActivity({
      userId: caller.userId,
      userName: caller.email,
      userEmail: caller.email,
      userRole: caller.role,
      action: "CREATE_SUBADMIN",
      resource: "users",
      details: { subAdminId: userId, subAdminEmail: cleanEmail, permissions },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      subadmin: {
        id: userId,
        name: newSubAdmin.name,
        email: cleanEmail,
        role: "subadmin",
        permissions: newSubAdmin.permissions,
        isActive: true,
        createdAt: now,
      },
    });
  } catch (err: any) {
    req.log?.error?.({ err }, "Create subadmin error");
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ─── 3. Update Sub-Admin (Permissions, Name, Status, Password) ───────────────
router.put("/subadmins/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const caller = (req as any).user;
    const { id } = req.params;
    const { name, permissions, isActive, password } = req.body;

    const userDoc = await firestore.collection("users").doc(String(id)).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Sub-admin not found" });
    }

    const updates: Record<string, any> = { updatedAt: nowTs() };
    if (name !== undefined) updates.name = name.trim();
    if (Array.isArray(permissions)) updates.permissions = permissions;
    if (isActive !== undefined) updates.isActive = Boolean(isActive);
    if (password && password.trim().length > 0) {
      updates.passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    await firestore.collection("users").doc(String(id)).update(updates);

    await logActivity({
      userId: caller.userId,
      userName: caller.email,
      userEmail: caller.email,
      userRole: caller.role,
      action: "UPDATE_SUBADMIN",
      resource: "users",
      details: { subAdminId: id, updates: { name, permissions, isActive, passwordChanged: !!password } },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: "Sub-admin updated successfully" });
  } catch (err: any) {
    req.log?.error?.({ err }, "Update subadmin error");
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ─── 4. Delete / Deactivate Sub-Admin ────────────────────────────────────────
router.delete("/subadmins/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const caller = (req as any).user;
    const { id } = req.params;

    const userDoc = await firestore.collection("users").doc(String(id)).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Sub-admin not found" });
    }

    await firestore.collection("users").doc(String(id)).delete();

    await logActivity({
      userId: caller.userId,
      userName: caller.email,
      userEmail: caller.email,
      userRole: caller.role,
      action: "DELETE_SUBADMIN",
      resource: "users",
      details: { subAdminId: id },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: "Sub-admin removed successfully" });
  } catch (err: any) {
    req.log?.error?.({ err }, "Delete subadmin error");
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

export default router;
