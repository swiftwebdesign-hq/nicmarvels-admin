# Niksmarvel Admin Portal — Netlify

This package is a standalone Netlify site for the private admin portal.

## Deploy
1. Create a separate Netlify site from this folder/repository.
2. Netlify will use the included `netlify.toml`.
3. The admin portal and `/api/*` function are deployed on the same origin.
4. Do **not** upload or commit `server/.env`; configure the server variables in Netlify Site configuration → Environment variables.

## Environment variables
Set these in Netlify for the site/function (never in browser files or the ZIP):
- `APPWRITE_ENDPOINT`
- `APPWRITE_PROJECT_ID`
- `APPWRITE_API_KEY`
- `APPWRITE_DATABASE_ID`
- `APPWRITE_REGISTRATIONS_TABLE_ID`
- `APPWRITE_STORAGE_BUCKET_ID`
- `APPWRITE_ADMIN_USER_ID`
- `ADMIN_EMAIL`
- `ALLOWED_ORIGINS` — add the exact HTTPS origins of the public form and admin portal when they are hosted on different Netlify sites. The current server also permits its own Netlify `URL` automatically.
- `PUBLIC_FORM_URL` is no longer injected into browser files during the build, because Netlify secret scanning can reject a public URL when the same value is also listed in `ALLOWED_ORIGINS`. Set `publicFormUrl` in `config.js` to the public enrollment URL if you want the “Back to enrollment form” link to point to the separate public site.

Do not place private credentials in `config.js` or other browser files.
