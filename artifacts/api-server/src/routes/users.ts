import { Router } from "express";
import { firestore, nextId, nowTs } from "@workspace/db";

const router = Router();

router.get("/user/profile", async (req, res) => {
  const email = req.query["email"] as string | undefined;
  if (!email) {
    res.status(400).json({ error: "email query param required" });
    return;
  }

  try {
    const usersSnap = await firestore
      .collection("users")
      .where("email", "==", email.toLowerCase().trim())
      .limit(1)
      .get();
      
    if (usersSnap.empty) {
      res.status(404).json({ error: "not found" });
      return;
    }
    
    // Convert doc to object (similar to docToObj)
    const doc = usersSnap.docs[0];
    const data = doc.data();
    
    res.json({
      id: doc.id,
      email: data.email,
      name: data.name,
      boardId: data.boardId,
      boardName: data.boardName,
      standardId: data.standardId,
      standardName: data.standardName,
      role: data.role,
    });
  } catch (err) {
    req.log.error({ err }, "Get user profile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/user/profile", async (req, res) => {
  const { email, name, boardId, boardName, standardId, standardName } = req.body ?? {};
  if (!email) {
    res.status(400).json({ error: "email is required" });
    return;
  }

  try {
    const normalizedEmail = String(email).toLowerCase().trim();
    
    // Check if user already exists
    const usersSnap = await firestore
      .collection("users")
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();

    const now = nowTs();
    
    if (!usersSnap.empty) {
      // Update existing user
      const doc = usersSnap.docs[0];
      const updates: any = { updatedAt: now };
      
      if (name != null) updates.name = String(name);
      if (boardId != null) updates.boardId = String(boardId);
      if (boardName != null) updates.boardName = String(boardName);
      if (standardId != null) updates.standardId = String(standardId);
      if (standardName != null) updates.standardName = String(standardName);
      
      await doc.ref.update(updates);
    } else {
      // Create new user
      const userId = await nextId("users");
      const userData = {
        id: userId,
        email: normalizedEmail,
        name: name != null ? String(name) : "",
        boardId: boardId != null ? String(boardId) : null,
        boardName: boardName != null ? String(boardName) : null,
        standardId: standardId != null ? String(standardId) : null,
        standardName: standardName != null ? String(standardName) : null,
        role: "student",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      
      await firestore.collection("users").doc(String(userId)).set(userData);
    }
    
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Save user profile error");
    // Mobile app silently fails and ignores this error anyway
    res.status(500).json({ error: "Internal server error" });
  }
});

export const usersRouter = router;
