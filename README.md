# Alta-style personal closet

A personal AI-stylist web app: photograph your real wardrobe, get outfit suggestions built
from it, and see an avatar of *yourself* wearing the look — rendered by Gemini.

## Setup

**1. Add your Gemini key**

```bash
cp backend/.env.example backend/.env
# then edit backend/.env and set GEMINI_API_KEY=...
```

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

Open **Profile** in the app — it shows a green banner when Gemini is connected, or an amber
one telling you what's wrong. Or hit `http://localhost:8000/api/health/gemini` directly.

## How to use it

1. **Profile** → upload a full-body photo of yourself (front is the one that gets used).
2. **+** → add closet items. Snap or upload photos, hit *Auto-fill details from photo* to
   let Gemini read the brand, category, description and colour, then Save.
3. **Home** → Alta builds looks from what you own. *New looks* reshuffles them.
4. **Create Avatar** → renders you wearing that outfit. *Regenerate* for another take.
5. **Calendar** → `+` on any day cycles through your saved looks to plan ahead.

## Where the AI is used

| Feature | Model | Code |
| --- | --- | --- |
| Auto-fill item details from a photo | `gemini-3.6-flash` | `analyze_item` |
| Cut the item out onto white | `gemini-3.1-flash-image` | `cutout_item` |
| Render you wearing an outfit | `gemini-3.1-flash-image` | `generate_tryon` |

All three live in [backend/app/gemini.py](backend/app/gemini.py). Model IDs are overridable
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
   signal, which is why `face` is its own slot on the Profile page.
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
| GET/PUT/DELETE | `/api/calendar` | Plan outfits by date |

Interactive docs at `http://localhost:8000/docs`.

## Testing

```bash
npm run e2e        # uploads an item through the real form, walks every screen
```

Needs both servers running. Screenshots land in `./shots`.

## Architecture notes

- **Storage** is the local `backend/uploads/` folder and **DB** is SQLite (`backend/alta.db`)
  — zero external accounts to get started. Both are swappable: `storage.py` is the only
  file that touches disk, and the schema is plain SQL ready for Postgres/Neon.
- **Single-tenant for now.** Every table already carries `user_id` (fixed to `DEMO_USER_ID`
  in `config.py`), so adding auth means replacing that default, not migrating data.
- **Placeholders remain as fallbacks.** `GarmentShape` / `AvatarSilhouette` render whenever
  a real image is missing, so the UI never shows broken tiles.
