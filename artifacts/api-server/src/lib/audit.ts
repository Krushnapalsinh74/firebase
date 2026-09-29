import { firestore, nextId, nowTs } from "@workspace/db";

export interface ActivityLogEntry {
  userId: number;
  userName: string;
  userEmail: string;
  userRole: string;
  action: string;
  resource?: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

export async function logActivity(entry: ActivityLogEntry): Promise<void> {
  try {
    const id = await nextId("activityLogs");
    const logData = {
      id,
      userId: entry.userId,
      userName: entry.userName || "User",
      userEmail: entry.userEmail || "",
      userRole: entry.userRole || "admin",
      action: entry.action,
      resource: entry.resource || null,
      details: entry.details || {},
      ipAddress: entry.ipAddress || null,
      createdAt: nowTs(),
    };
    await firestore.collection("activityLogs").doc(String(id)).set(logData);
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
}
