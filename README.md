# Ostler Trip 2027

A GitHub Pages-ready React mockup for private, device-local vacation voting.

## Roadmap

1. **Now — prototype:** voters choose their name, view trip cost/travel/property details, and rate each option 1–5 stars.
2. **Content pass:** replace the sample entries in `src/main.jsx` with the real Airbnb/VRBO links, photos, pricing, travel estimates, and voter names.
3. **Privacy decision:** this static version stores each voter's ballot only in that browser's local storage, encrypted with the PIN they create. There is no PIN recovery and it cannot combine or recover votes from other devices—which is what keeps it backend-free. A truly shared, private ballot would require a small authenticated service.
4. **Publish:** push the `main` branch to GitHub, then select **GitHub Actions** as the Pages source in **Settings → Pages**. The included workflow builds and deploys the site on every subsequent push to `main` (or when run manually from the Actions tab).

## Run locally

```bash
npm install
npm run dev
```

## Edit the trips

Change the `trips` and `voters` arrays at the top of `src/main.jsx`. Use each property's listing URL for `url` and a direct image URL for `image`.
# Ostler Trip 2027 Voting

## One-time Supabase setup

1. In the Supabase project, open **SQL Editor** and run the complete contents of [`supabase/schema.sql`](./supabase/schema.sql).
2. Deploy this site to GitHub Pages as usual.

The frontend uses Supabase's browser-safe publishable key only. It calls four restricted database functions to create, unlock, and save a household ballot. Direct reads of the `ballots` table are blocked, and the table stores only a bcrypt PIN hash plus the vote JSON.

The 4-digit PIN is convenient for the family, rather than high-security authentication. Keep the Supabase database password and service-role key private; neither belongs in GitHub Pages or this repository.

## Admin view

The admin page is at `/admin` (GitHub Pages forwards that URL to the app). Run the **PIN-ONLY ADMIN** block at the bottom of [`supabase/schema.sql`](./supabase/schema.sql), then enter the existing Jefferson / Amber household PIN. The table itself remains private; the admin functions verify that PIN server-side before returning or changing any ballot.

## Public results

Run the **PUBLIC RESULTS** block at the bottom of [`supabase/schema.sql`](./supabase/schema.sql). The `/results` page then publicly shows only households that submitted, their favorite, and each trip's star rating. Unsubmitted ballots and PIN hashes remain private.
