import express from "express";
import { createServer as createViteServer } from "vite";
import { Resend } from "resend";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  const resendApiKey = process.env.RESEND_API_KEY;
  const resend = resendApiKey ? new Resend(resendApiKey) : null;

  app.use(cors());
  app.use(express.json());

  // API routes
  app.post("/api/send-verification", async (req, res) => {
    const { email, schoolName, token } = req.body;

    if (!email || !schoolName || !token) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const recipientEmail = email.trim();

    try {
      const appUrl = process.env.APP_URL || "http://localhost:3000";
      const verificationLink = `${appUrl}/complete-registration?email=${encodeURIComponent(recipientEmail)}&token=${token}`;

      console.log("--------------------------------------------------");
      console.log(`ATTEMPTING EMAIL SEND TO: ${recipientEmail}`);
      console.log(`LINK: ${verificationLink}`);
      console.log("--------------------------------------------------");

      if (!resend) {
        console.warn("RESEND_API_KEY is not set. Email not sent, but link logged above.");
        return res.status(200).json({ 
          message: "RESEND_API_KEY is missing. Verification link logged to server console for testing.",
          link: verificationLink 
        });
      }

      const { data, error } = await resend.emails.send({
        from: "support@edumanagepro.com",
        to: recipientEmail,
        subject: "Complete Your Registration - EduManagePro",
        text: `Welcome to EduManagePro! Thank you for registering ${schoolName}. To complete your registration and set your password, please visit: ${verificationLink}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #800000;">Welcome to EduManagePro!</h2>
            <p>Hello,</p>
            <p>Thank you for registering <strong>${schoolName}</strong>. To complete your registration and set your password, please click the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationLink}" style="background-color: #800000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Complete Registration</a>
            </div>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${verificationLink}</p>
            <p>This link will expire in 24 hours.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #999;">If you didn't request this, please ignore this email.</p>
          </div>
        `,
      });

      if (error) {
        console.error("Resend Detailed Error:", JSON.stringify(error, null, 2));
        return res.status(400).json({
          error: "Resend validation failed",
          details: error
        });
      }

      res.status(200).json(data);
    } catch (error) {
      console.error("Server error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  app.post("/api/send-email", async (req, res) => {
    const { to, subject, text, html } = req.body;

    if (!to || !subject || (!text && !html)) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      console.log("--------------------------------------------------");
      console.log(`ATTEMPTING EMAIL SEND TO: ${to}`);
      console.log(`SUBJECT: ${subject}`);
      console.log("--------------------------------------------------");

      if (!resend) {
        console.warn("RESEND_API_KEY is not set. Email not sent.");
        return res.status(200).json({ 
          message: "RESEND_API_KEY is missing. Email logged to server console for testing.",
        });
      }

      const { data, error } = await resend.emails.send({
        from: "support@edumanagepro.com",
        to,
        subject,
        text,
        html,
        replyTo: "support@edumanagepro.com"
      });

      if (error) {
        console.error("Resend Detailed Error:", JSON.stringify(error, null, 2));
        return res.status(400).json({
          error: "Resend validation failed",
          details: error
        });
      }

      res.status(200).json(data);
    } catch (error) {
      console.error("Server error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/send-sms", async (req, res) => {
    const { to, message } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const apiKey = process.env.AT_API_KEY;
      const username = process.env.AT_USERNAME || "sandbox";
      
      if (!apiKey) {
        console.warn("AT_API_KEY is not set. Simulating SMS sending.");
        console.log(`[SIMULATED SMS] To: ${to.join(',')} Message: ${message}`);
        return res.status(200).json({
          SMSMessageData: {
            Message: "Sent to the void (Simulation mode)",
            Recipients: to.map((num: string) => ({ statusCode: 101, number: num, status: "Success", cost: "0" }))
          }
        });
      }

      // We dynamically import to avoid loading it if not needed or causing issues with esm depending on how it's bundled
      const africastalking = (await import('africastalking')).default;
      const AT = africastalking({ apiKey, username });
      
      const result = await AT.SMS.send({
        to,
        message,
        // from: process.env.AT_SENDER_ID // optional
      });
      
      res.status(200).json(result);
    } catch (error) {
      console.error("SMS sending error:", error);
      res.status(500).json({ error: "Failed to send SMS" });
    }
  });

  app.post("/api/zoom/meeting", async (req, res) => {
    const { topic, date, time, duration } = req.body;

    if (!topic || !date || !time || !duration) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const accountId = process.env.ZOOM_ACCOUNT_ID || 'Qn8ZVok_SnWBQ8kCSLFbWA';
      const clientId = process.env.ZOOM_CLIENT_ID || 'NoGv1HepRM2zH_fsk2g8Jw';
      const clientSecret = process.env.ZOOM_CLIENT_SECRET || 'ZkMW7bFjok8NqxN1zeXHmIpiNdBW5hGD';

      // 1. Get Zoom Token
      const tokenUrl = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`;
      const tokenResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded"
        }
      });

      if (!tokenResponse.ok) {
        const errText = await tokenResponse.text();
        console.error("Zoom Token Auth Error:", errText);
        let errorMsg = "Failed to authenticate with Zoom API";
        try {
          const parsed = JSON.parse(errText);
          if (parsed.reason) errorMsg += `: ${parsed.reason}`;
        } catch (e) {
          errorMsg += `: ${errText}`;
        }
        throw new Error(errorMsg);
      }

      const { access_token } = await tokenResponse.json() as any;

      // 2. Create Meeting (using 'me' which resolves to the account owner for S2S OAuth)
      const meetingStart = `${date}T${time}:00Z`;
      const meetingResponse = await fetch(`https://api.zoom.us/v2/users/me/meetings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          topic,
          type: 2, // Scheduled meeting
          start_time: meetingStart,
          duration: Number(duration),
          settings: {
            host_video: true,
            participant_video: false,
            join_before_host: true,
            jbh_time: 0,
            mute_upon_entry: true,
            auto_recording: "cloud"
          }
        })
      });

      if (!meetingResponse.ok) {
        const errData = await meetingResponse.json() as any;
        console.error("Zoom meeting creation error:", errData);
        if (errData.code === 4711) {
           throw new Error(`Your Zoom API credentials do not have the required scopes to create meetings. Please go to Zoom App Marketplace > Your App > Scopes and add "meeting:write:admin" and "user:read:admin".`);
        }
        throw new Error(errData.message || "Failed to create Zoom meeting");
      }

      const meetingData = await meetingResponse.json() as any;

      res.status(200).json({
        joinUrl: meetingData.join_url,
        startUrl: meetingData.start_url,
        meetingId: meetingData.id
      });

    } catch (error: any) {
      console.error("Zoom API Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate zoom link" });
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
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
