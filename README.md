# Travelens 🌍
### GPS for the wandering soul

AI-powered personalised walking tours for any city in the world.

---

## Deploy in 10 minutes

### Step 1 — Get your Anthropic API key
1. Go to **platform.anthropic.com**
2. Sign up / log in
3. Click **API Keys** → **Create Key**
4. Copy the key (starts with `sk-ant-...`) — save it somewhere safe

---

### Step 2 — Put the code on GitHub
1. Go to **github.com** and sign up (free)
2. Click **New repository**
3. Name it `travelens`, set to **Public**, click **Create**
4. Upload these files by dragging them into the GitHub interface:
   - `public/index.html`
   - `public/manifest.json`
   - `public/sw.js`
   - `api/tour.js`
   - `vercel.json`

> **Note on icons:** For the home screen icon, create a simple green square PNG (192x192 and 512x512) and upload to a folder called `public/icons/`. You can make one free at **favicon.io** — pick green background (#1D9E75), white letter T.

---

### Step 3 — Deploy on Vercel
1. Go to **vercel.com** and sign up with your GitHub account
2. Click **Add New Project**
3. Select your `travelens` repository
4. Click **Deploy** — Vercel auto-detects the setup

---

### Step 4 — Add your API key (IMPORTANT)
This keeps your key secret and off-screen:
1. In Vercel, go to your project → **Settings** → **Environment Variables**
2. Add:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** your `sk-ant-...` key
3. Click **Save**
4. Go to **Deployments** → click the three dots on your latest deploy → **Redeploy**

---

### Step 5 — Your app is live!
Vercel gives you a URL like `travelens.vercel.app`

**Optional — custom domain:**
- Buy `travelens.app` or `travelens.co` from Namecheap (~$12/year)
- In Vercel: Settings → Domains → Add your domain
- Follow the DNS instructions (takes 10 minutes)

---

## Install on phone (PWA)

**iPhone:**
1. Open the URL in Safari
2. Tap the Share button (box with arrow)
3. Tap **Add to Home Screen**
4. Tap **Add**
5. Travelens icon appears on your home screen

**Android:**
1. Open the URL in Chrome
2. Tap the three-dot menu
3. Tap **Add to Home Screen** or **Install App**
4. Done!

---

## Project structure

```
travelens/
├── public/
│   ├── index.html       ← The full app UI
│   ├── manifest.json    ← Makes it installable as PWA
│   ├── sw.js            ← Service worker (offline support)
│   └── icons/
│       ├── icon-192.png ← App icon (make at favicon.io)
│       └── icon-512.png ← App icon large
├── api/
│   └── tour.js          ← Serverless function (keeps API key secret)
└── vercel.json          ← Vercel routing config
```

---

## Built with
- Claude API (claude-sonnet-4-6)
- Vanilla HTML/CSS/JS — no frameworks needed
- Vercel serverless functions
- PWA — installable on any phone, no app store needed

---

*Built by Malathi Damera — Travelens MVP, June 2026*
