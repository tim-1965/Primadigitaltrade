# Trade Digitalisation Benefits Calculator (Static Netlify Build)

This build is **fully static** (no Railway / backend API calls).
- Open `index.html` locally or deploy the folder to any static host.
- On Netlify: Publish directory = this folder, build command = none.

## Countries
All countries are included from ISO-3166 (generated via `pycountry`) in `components/countries.js`.

## Notes
The map uses D3 + topojson and fetches world topology from `world-atlas` CDN at runtime (no server required).
