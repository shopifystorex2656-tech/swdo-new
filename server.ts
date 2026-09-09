import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin
let projectId = "gen-lang-client-0625537224"; // Default to your project ID
const databaseId = "ai-studio-swdoportal-eaf4db89-dc05-4466-b5e1-0f0575777bc2";

// Force the project ID in the environment
process.env.GOOGLE_CLOUD_PROJECT = projectId;
process.env.GCLOUD_PROJECT = projectId;

let credential;
const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.FIREBASE_SERVICE_ACCOUNT;

if (serviceAccountVar) {
  try {
    const trimmed = serviceAccountVar.trim();
    if (trimmed.startsWith("{")) {
      const sa = JSON.parse(trimmed);
      credential = cert(sa);
      if (sa.project_id) {
        projectId = sa.project_id;
        process.env.GOOGLE_CLOUD_PROJECT = projectId;
        process.env.GCLOUD_PROJECT = projectId;
      }
      console.log(`Firebase initialized with Service Account JSON for project: ${projectId}`);
    } else {
      credential = cert(trimmed);
      console.log(`Firebase initialized with Service Account Path for project: ${projectId}`);
    }
  } catch (e) {
    console.error("Failed to initialize Firebase with service account, falling back to default:", e);
    credential = applicationDefault();
  }
} else {
  console.warn("WARNING: No FIREBASE_SERVICE_ACCOUNT_PATH found. The backend will attempt to use default credentials, which may fail in this environment.");
  console.log(`Using Application Default Credentials for project: ${projectId}`);
  credential = applicationDefault();
}

const adminApp = initializeApp({
  credential,
  projectId,
});
const db = getFirestore(adminApp, databaseId);
console.log(`Firestore initialized for project: ${projectId}, database: ${databaseId}`);

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // API routes
  app.post("/api/approve-donation", async (req, res) => {
    const { donationId, adminUsername } = req.body;
    console.log(`Received approval request for: ${donationId} by ${adminUsername}`);
    
    try {
      const donationRef = db.collection("donations").doc(donationId);
      const doc = await donationRef.get();
      
      if (!doc.exists) {
        console.error(`Donation ${donationId} not found`);
        return res.status(404).json({ error: "Donation not found" });
      }

      const donation = doc.data() as any;
      console.log("Donation data retrieved:", donation);

      // Update Firestore
      await donationRef.update({
        Status: "Approved",
        ApprovedBy: adminUsername,
        ApprovedAt: new Date().toISOString(),
      });
      console.log("Firestore update successful");

      res.json({ success: true });
    } catch (error) {
      console.error("Backend approval error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to approve donation" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
