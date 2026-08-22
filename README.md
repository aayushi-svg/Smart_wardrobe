# CLOSEI

A personal AI-stylist web app: photograph your real wardrobe, get outfit suggestions built
from it, and see an avatar of *yourself* wearing the look — rendered by Gemini.

## Setup

**1. Configure the backend**

```bash
cp backend/.env.example backend/.env
```

Then edit `backend/.env` and set:

- `GEMINI_API_KEY` — from https://aistudio.google.com/apikey
- `DATABASE_URL` — your Neon connection string (Dashboard → Connection Details)
- `JWT_SECRET` — `python -c "import secrets; print(secrets.token_urlsafe(48))"`

Tables are created automatically on first boot. `GOOGLE_CLIENT_ID` is optional and
only controls whether the login screen offers "Continue with Google".

**2. Backend** (first run creates the venv)

```bash
cd backend
py -m venv venv
venv/Scripts/python -m pip install -r requirements.txt
cd ..
npm run dev:api          # http://localhost:8000
```

**3. Frontend** (separate terminal)

```bash
npm install
npm run dev              # http://localhost:5173
```

Vite proxies `/api` and `/uploads` to the backend, so there is nothing else to configure.

**4. Check the key took**

Open **Settings** in the app — it shows a green banner when Gemini is connected, or an
amber one telling you what's wrong. Or hit `http://localhost:8000/api/health/gemini`.

## How to use it

1. **Sign up** with an email and password. A four-step wizard then collects your details,
   fit and sizes, your identity photos, and your first piece. It remembers which step you
   reached, so closing the tab mid-signup resumes where you left off.
2. **+** → add closet items. Snap or upload photos, hit *Auto-fill details from photo* to
   let Gemini read the brand, category, description and colour, then Save.
3. **Home** → Closei builds looks from what you own. *New looks* reshuffles them.
4. **Create avatar** → renders you wearing that outfit. *Regenerate* for another take,
   *Save* to keep it under **Avatars**, or download the PNG.
5. **Calendar** → tap any day to pick a look. Planned days show the full render; the
   settings sheet controls week start, picture size, streak, colour dots and today's outline.
6. **Chat** → ask Closei anything. It can see your profile and your whole wardrobe, and
   answers stream in. Conversations are saved under *History*.

Every image in the app opens full-screen on tap, with download and save buttons.

## Where the AI is used

| Feature | Model | Code |
| --- | --- | --- |
| Auto-fill item details from a photo | `gemini-3.6-flash` | `analyze_item` |
| Cut the item out onto white | `gemini-3.1-flash-image` | `cutout_item` |
| Render you wearing an outfit | `gemini-3.1-flash-image` | `generate_tryon` |
| Stylist chat, grounded in your closet | `gemini-3.6-flash` | `chat_stream` |
| Naming a chat thread | `gemini-3.6-flash` | `title_for` |

All of these live in [backend/app/gemini.py](backend/app/gemini.py). Model IDs are overridable
via `GEMINI_IMAGE_MODEL` / `GEMINI_TEXT_MODEL` in `.env`.

Item cut-outs run in the background after upload, so adding an item stays instant; if the
call fails the original photo is kept and you can retry from the wand button in the closet
grid. Try-on generation passes the body reference first, then each garment photo, and
prompts the model to keep your face and proportions fixed.

If items are missing details or cut-outs (e.g. they were added before the key was set), the
closet page shows a **Complete with AI** button that backfills them one at a time. Because
that can re-categorise an item, it rebuilds the outfit suggestions afterwards.

### Keeping the face consistent

The image model has **no seed parameter**, so renders are never byte-identical. Two things
keep the person recognisable anyway:

1. **Every reference photo is sent as a character anchor** (up to 4, face first). A face in a
   full-body shot is only a few dozen pixels tall — a close portrait carries far more identity
   signal, which is why `face` is its own slot in onboarding and on the Profile page.
2. **The prompt is framed as an edit, not a generation.** It names the image roles explicitly,
   states *"Ensure the person's face and features remain completely unchanged"*, forbids
   beautifying/slimming/restyling, pins the hairstyle, and bans accessories that aren't in the
   outfit list. Wording follows Google's documented pattern for character consistency.

Residual drift is mostly hairstyle and occasionally an invented earring; adding a sharp face
reference is the highest-leverage fix.

Cut-outs come back on solid white rather than transparent, so item images render with
`mix-blend-mode: multiply` — the white drops into the card and the garment floats.

Once a look has been rendered, the avatar sits inline in the right-hand third of its
flat-lay card (the item columns shift left to make room) and the button becomes
*View Avatar*. Clicking the image reopens the modal to regenerate.

**Outfit lifecycle.** `suggested` looks make up the feed and are swept away when you ask for
new ones. Rendering an avatar parks a look in `generating` so a concurrent refresh can't
delete it mid-call, then returns it to its previous state — so a generated avatar stays
visible in the feed. Only calendar planning promotes a look to `saved`, and the sweep skips
anything referenced by a calendar entry. Rows left in `generating` by a killed process are
reset on startup.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/items` | List closet (`?wishlist=true` for the wishlist) |
| POST | `/api/items` | Create item — multipart, repeatable `files` |
| POST | `/api/items/analyze` | Photo → suggested brand/category/description/colour |
| PATCH/DELETE | `/api/items/{id}` | Edit / remove |
| POST | `/api/items/{id}/cutout` | Re-run background removal |
| POST | `/api/items/{id}/enrich` | Backfill missing details **and** cutout for one item |
| GET/POST/DELETE | `/api/avatar-references` | Identity photos (face/front/side/back) |
| GET | `/api/outfits/suggestions` | Looks built from your closet (`?refresh=true`) |
| POST | `/api/outfits/{id}/avatar` | **Generate the try-on render** |
| DELETE | `/api/outfits/{id}` | Dismiss a look |
| GET/PUT/DELETE | `/api/calendar` | Plan outfits by date |
| GET/PUT | `/api/calendar-settings` | Per-user calendar preferences |
| GET/POST/PATCH/DELETE | `/api/saved-avatars` | Renders the user chose to keep |
| POST | `/api/auth/register` · `/login` · `/google` · `/logout` | Sessions |
| GET | `/api/auth/me` · `/api/auth/config` | Current user · enabled providers |
| POST/DELETE | `/api/auth/password` · `/api/auth/account` | Change password · delete account |
| GET/PATCH | `/api/me` | Profile; `POST /api/me/photo` for the avatar image |
| POST | `/api/me/onboarding/complete` · `/restart` | Finish or redo the wizard |
| GET/DELETE | `/api/chat/threads` | Conversations |
| POST | `/api/chat/messages` | **Streaming reply** (SSE) |

Every route except `/api/auth/config`, `/api/auth/register`, `/api/auth/login`,
`/api/auth/google` and the health checks requires a session and is scoped to that user.

Interactive docs at `http://localhost:8000/docs`.

## Testing

```bash
npm run e2e        # registers an account, walks onboarding, then every screen
```

Needs both servers running. Each run signs up a fresh `e2e-<timestamp>@example.com`, so
runs are independent. Screenshots land in `./shots`; the run fails on any unexpected
console error.

## Architecture notes

- **DB is Neon Postgres**, reached through one process-wide `psycopg` pool in
  [backend/app/db.py](backend/app/db.py). **Image bytes stay on local disk** under
  `backend/uploads/`; `storage.py` is the only file that touches the filesystem, so moving
  to object storage means changing that one module.
- **Sessions are signed JWTs in an httpOnly, SameSite=Lax cookie.** Passwords are
  PBKDF2-HMAC-SHA256 (390k iterations) from the stdlib, so the backend installs with no
  compiled dependencies. Set `COOKIE_SECURE=true` once you serve over HTTPS.
- **Every row is scoped to its owner.** Each router takes `Depends(current_user_id)` and
  filters on it, and every table cascades from `users(id)` — deleting an account removes
  its closet, looks, calendar, avatars and chats in one statement.
- **Two outfit lists in the store.** `outfits` is the suggestion feed; `allOutfits` is
  everything the user owns. The calendar and day strip read the latter, because planning a
  look promotes it to `saved` and it leaves the suggestion feed.
- **Placeholders remain as fallbacks.** `GarmentShape` / `AvatarSilhouette` render whenever
  a real image is missing, so the UI never shows broken tiles.
- **Animation lives in CSS**, not a library — keyframes and `.animate-*` / `.stagger`
  helpers in `src/index.css`, all disabled under `prefers-reduced-motion`.

### Coming from the old SQLite build

The pre-Neon `backend/alta.db` was single-tenant. To pull it into an account, sign up in
the app first, then:

```bash
cd backend
venv/Scripts/python scripts/import_sqlite.py you@example.com
```

It copies items, photos, body references, outfits and calendar entries, re-pointing the
existing files in `backend/uploads/` rather than re-uploading. It is safe to re-run and
never modifies `alta.db`.
