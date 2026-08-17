# Atelier — the garment workbench

Anyone getting an outfit stitched from scratch does it blind: flip through a
tailor's dusty catalog, point at a fabric, describe a design with your hands,
and hope. **Atelier replaces that with a visual workbench where materials are
the primitives, not images.** You aren't prompting an image generator — you are
assembling a real, orderable garment out of a real catalog, and every drop
updates a tailor-ready bill of materials.

```
node server/server.mjs
# open http://localhost:4141
```

Zero dependencies — plain Node (v22) and one static HTML file. Put your key in
`.env.local` as `YOUCAM_API_KEY=...` (gitignored). `ANTHROPIC_API_KEY` is
optional; without it the brief is parsed on-device and the UI says so.

## The four stages

**1 — Brief.** A near-empty canvas, one input. Type or *speak* the idea (Web
Speech API, English / हिन्दी / తెలుగు), plus chips for occasion, silhouette and
budget band. The text is parsed into a **structured design spec** (garment,
colour, fabric hints, occasion, season, embellishments, weight) — never sent raw
to an image model. The UI always labels which parser ran.

**2 — Design model.** Three construction studies drawn as clean technical
renders — A-line, twelve-kali, mermaid — showing panels, seams, neckline,
sleeve, hem and dupatta on a neutral form. Pick one to take forward.

**3 — The material workbench.** The main event, three panes:
- **Left**: the catalog — **61 real materials** across fabrics, threads,
  embellishments and trims. Each swatch carries name, ₹/metre, gsm and drape
  rating, drawn as an actual texture tile (CSS gradients, no image assets).
- **Centre**: the garment with **five live zones** — bodice, sleeves, skirt,
  hem border, dupatta. Drag a swatch onto a zone and *only that zone*
  re-renders: the material becomes an SVG `<pattern>` fill, with a 300ms
  fabric-settle animation. Everything else stays locked. Undo and version
  snapshots (v1…v8) are one click.
- **Right**: the co-designer and the running spec sheet.

**4 — Try-on & handoff.** Add a full-body photo, hit drape: the composed
garment is rasterized (construction lines stripped) and sent with the photo to
**YouCam `cloth-v4`**, which returns the customer wearing those exact materials.
Then **Export spec sheet** prints a tailor handoff: front render, try-on render,
zone-by-zone material table with meterage and cost, a blank measurements form.

## The co-designer is opinionated, not decorative

It reasons over the catalog's real physical attributes (gsm, drape rating,
tags) and the parsed brief, and speaks up on placement:

> *"Velvet on the sleeves adds weight a Georgette bodice can't carry — try
> organza or chanderi there."*
> *"Velvet is heavy for a dupatta — it will sit, not float."*
> *"A georgette skirt reads light; your brief said a heavy build."*

It also flags budget: cross the band you picked and it names the costliest line
and tells you to swap it. These are deterministic rules over real numbers — no
model call, no latency, and it can't hallucinate a material that isn't stocked.

## APIs

| API | Used for | Cost |
|---|---|---|
| YouCam `POST /s2s/v2.0/file` (+ presigned PUT) | uploading the composed garment & the photo | 0 units |
| YouCam `POST /s2s/v2.0/task/cloth-v4` | Stage 4 try-on — the drape onto the customer | 2 units |
| YouCam `GET /s2s/v1.0/client/credit` | live balance, and the before/after metering read | free |
| Anthropic Messages API | brief → design spec JSON, when a key is present | — |
| Web Speech API | the voice brief, on-device, three languages | free |

## Engineering notes

- **Server-side proxy.** The browser never talks to YouCam; the Node server
  holds the key and does upload → task → poll → download.
- **Zone rendering costs nothing.** Materials apply as SVG `<pattern>` fills, so
  drag-and-drop is instant and infinitely repeatable at zero units. Only the
  final try-on spends. (The spec's Gemini zone re-render is the upgrade path;
  the SVG route is what makes the workbench feel real *now*.)
- **Honest metering.** The try-on is wrapped in a before/after balance read and
  the observed delta is what the UI reports — measured live at 2 units, 1087 →
  1085.
- **Cached, failures included.** Keyed by `sha256(garment + photo + category)`.
  A repeat drape is free. A *failed* one is also cached, because failed YouCam
  tasks still charge units — Atelier refuses to blind-retry a known-bad combo.
- **Result URLs expire in 2 hours**, so every render is downloaded to
  `public/renders/` immediately and nothing user-facing points at YouCam.
- Task ids exceed 2^53 and are kept as strings, never `JSON.parse`d to numbers.

## Design notes

Warm ivory paper `#F7F3EC` with a real grain, off-black ink, one accent
(marigold `#D97706`). Hairline 1px borders, 3px radii, no drop shadows, no
gradients. Instrument Serif for display at tight tracking; Inter for UI;
JetBrains Mono with tabular figures on every price, meterage and unit count.
Drag ghosts follow the cursor at 0.9 scale, valid zones outline in accent, and
genuine waits show a shimmering weave — never a spinner or a fake progress bar.

## Files

- `server/server.mjs` — http server, brief parser, cached try-on pipeline (4141)
- `server/youcam.mjs` — verified YouCam client (upload, task+poll, ledger, throttle)
- `public/index.html` — the entire studio: catalog, workbench, co-designer, export
- `public/sample.jpg` — AI-generated sample customer, so try-on demos without a real photo
