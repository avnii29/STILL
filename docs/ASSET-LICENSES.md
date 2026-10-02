# STILL asset licenses

Inspected 2026-09-25 from `/public` and font imports.  
No root `LICENSE` file exists in the repository.

If provenance cannot be established, the asset is flagged **DO NOT SHIP** for public commercial deployment.

| filename | source | creator | license | commercial-use status | attribution requirement | modification permission |
|----------|--------|---------|---------|----------------------|-------------------------|-------------------------|
| `public/still-sky-morning.jpg` / `.webp` | supplied into the working tree as landing art; no license file | unknown | unknown | **DO NOT SHIP** until license confirmed | unknown | unknown |
| `public/still-sky-afternoon.jpg` / `.webp` | same | unknown | unknown | **DO NOT SHIP** | unknown | unknown |
| `public/still-sky-evening.jpg` / `.webp` | derived in-repo by blending afternoon + night (ImageMagick) from the same unknown sources | unknown originals | unknown | **DO NOT SHIP** | unknown | unknown |
| `public/still-sky-night.jpg` / `.webp` | supplied into the working tree; no license file | unknown | unknown | **DO NOT SHIP** | unknown | unknown |
| `public/still-landscape.jpg` / `.webp` / `.mp4` | unused orphans in `/public` | unknown | unknown | **DO NOT SHIP** (also unused) | unknown | unknown |
| `public/still-mark.png` / `still-mark.svg` | STILL brand mark used in the product | **REQUIRES CONFIRMATION** (appears original to the project; not documented) | unknown | **DO NOT SHIP** commercially until the operator confirms authorship | unknown | unknown |
| `public/still-logo.png` / `still-logo-tight.png` / `still-logo-192.png` / `still-logo-512.png` / `apple-touch-icon.png` | STILL icons | **REQUIRES CONFIRMATION** | unknown | **DO NOT SHIP** until authorship confirmed | unknown | unknown |
| `public/file.svg` `globe.svg` `next.svg` `vercel.svg` `window.svg` | default Create Next App leftovers; unused | Vercel / Next.js | Next.js project defaults | unused; do not present as STILL brand | follow Next.js / Vercel marks policy if ever shown | n/a |
| `public/manifest.webmanifest` `sw.js` `offline.html` | authored in this repository | STILL project | same as the application source (unset) | application code | none | yes, by the operator |
| Figtree (via `next/font/google`) | Google Fonts, self-hosted after build | Erik Kennedy / Google Fonts | SIL Open Font License 1.1 | allowed | OFL reserved-name rules | allowed under OFL |
| Fraunces (via `next/font/google`) | Google Fonts, self-hosted after build | Undercase Type / Google Fonts | SIL Open Font License 1.1 | allowed | OFL reserved-name rules | allowed under OFL |
| Lucide icons (`lucide-react`) | npm dependency | Lucide contributors | ISC | allowed | license notice in dependency | allowed |
| Georgia (offline.html / unused SVG text) | system / core font | system | system font | local fallback only | none | n/a |

The landscape cycle is the user-visible background of `/` and auth. It must be replaced or licensed before a public commercial launch.

`npm run trust:check` fails in production mode while any in-use sky or mark asset remains flagged **DO NOT SHIP**.
