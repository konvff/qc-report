# QC Inspection Report App

Generates your exact Word inspection report from data entered in a web app.

**Important fix in this version:** earlier builds could leak leftover
checkbox/photo/text data from the sample report used as the master template.
This version runs a full sanitizer on every generation (verified: zero
leftover checkboxes, zero leftover photos, zero leftover text in a blank
test), uses the document's real checkbox mechanism, and pulls all 122 photo
slots (with their real captions) directly from your template so nothing is
hand-typed or out of sync. Product category, PO rows, and AQL results are
now fully dynamic — tables grow/shrink to match your data and totals are
calculated automatically.

---

## Running it locally (plain Python — simplest option)

No Docker required. This is the fastest way to try it on your own machine.

**Requirements:** Python 3.11+ installed (check with `python3 --version`).

```bash
cd qc-report-app/backend
pip install -r requirements.txt
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Open **http://localhost:8000** in your browser.

Log in with:
- Email: `admin@example.com`
- Password: `changeme123`

That's it — it uses a local SQLite database file (`qc_reports.db`, created
automatically) and stores uploaded photos in `backend/app/uploads/`. Nothing
else to install or configure.

**To reset everything** (wipe all reports/users and start fresh):
```bash
cd qc-report-app/backend
rm -f qc_reports.db
rm -rf app/uploads/* app/generated/*
```
Then start the server again — a fresh admin account is created automatically.

**Common issues:**
- `pip install` fails on `psycopg2-binary` → you don't need it for local
  SQLite use. Remove that line from `requirements.txt` if it fails, or
  install `postgresql-dev`/`libpq-dev` via your system package manager first.
- Port 8000 already in use → run with `--port 8001` (or any free port)
  instead, and open that port in the browser.
- "command not found: python3" → try `python` instead, or install Python
  from https://python.org.

---

## Running it locally with Docker (optional)

If you'd rather use Docker (e.g. to test against Postgres, closer to a real
deployment):
```bash
docker compose up --build
```
Then open http://localhost:8000 — same login as above.

If you hit an error during generation specifically, it's most likely fixed
in this version — but if you still see one, the exact error message (visible
in the terminal running `docker compose up`, or via `docker compose logs
app`) will say exactly what failed; happy to debug further with that in hand.

---

## Getting it online for your team (one-time setup, ~10 minutes)

See below — unchanged from before, still no coding required.

### Step 1 — Put the code on GitHub
1. Go to https://github.com and create a free account if you don't have one.
2. Click **New repository**, name it `qc-report-app`, keep it **Private**, click **Create repository**.
3. On the new repository page, click **uploading an existing file** and drag in
   this entire project folder.

### Step 2 — Deploy on Render (free to start)
1. Go to https://render.com and sign up (one click with GitHub).
2. Click **New +** → **Web Service**, connect the `qc-report-app` repo.
3. Render detects the `Dockerfile` automatically. Click **Create Web Service**.
4. Click **New +** → **PostgreSQL** to create a free database, name it `qc-reports-db`.
5. Back on your Web Service → **Environment** tab, add:
   - `DATABASE_URL` → the **Internal Database URL** from your PostgreSQL page
   - `SECRET_KEY` → any random long text
   - `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD` → your first login
6. Save — Render builds and deploys automatically (~3-5 minutes), giving you
   a permanent link like `https://qc-report-app.onrender.com`.

---

## How the workflow works

1. **Admin/office** creates a report, fills Product Category, PO Details, and
   the Checklists tab.
2. **QC inspector** opens the same report, fills AQL results, defects (fixed
   12-item taxonomy, matching your template exactly — just enter counts for
   what you actually observed), measurements, onsite tests, shrinkage, and
   uploads photos into named slots that match your original report's photo
   captions one by one (each slot's title is editable before or after upload).
3. Either person clicks **Generate Word Report** — downloads a `.docx`
   identical in formatting to your original template, built fresh from a
   fully sanitized copy of it every single time.

---

## What's covered

- Report Info, Product Category, PO Details (dynamic row count + auto totals)
- AQL results, Defects log (fixed taxonomy, auto totals + Pass/Fail)
- Standards & Reference and Marking & Labeling checklists (real checkboxes)
- Measurements, Onsite Tests, Shrinkage Test
- 122 dynamically-discovered, individually-titled photo slots across 6 galleries
- Roles: Admin (paperwork/setup) and QC (findings/photos)
- Multi-factory support

## Known limitation

The **Packing Details** matrix (bag types, closures, certifications) is
wired up in the backend/generator but doesn't yet have a frontend tab of its
own — it currently generates blank (correctly, not leaking old data) unless
data is sent directly via the API. This is the next thing to build a UI for.

