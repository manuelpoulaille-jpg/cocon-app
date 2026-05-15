// api/drive.js
// Route Vercel qui proxifie vers Google Apps Script sans problème de CORS
// Placer dans : /api/drive.js (à la racine du projet, pas dans /src)

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const WEBHOOK = "https://script.google.com/macros/s/AKfycbza4QR7FaxPNlYv_cFeOEhoRJfKX_HQzH2NSaKsX-lSZNZSMb-_ikfUKxzUZeb5S0J1/exec";

  try {
    const response = await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(req.body),
      redirect: "follow",
    });

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // Apps Script a répondu mais pas en JSON — on considère OK
      data = { success: true, raw: text };
    }

    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}
