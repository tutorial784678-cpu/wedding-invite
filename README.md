# Cinematic Wedding Invitation

A premium, animated wedding invitation with a cinematic opening card, wax seal, background video, dynamic couple names, server-side configuration, Google Apps Script backend, Google Sheets RSVPs, countdown, timeline, pre-wedding events and admin dashboard.

The included `assets/wedding-video.mp4` / `assets/opening-animation.mp4` is the supplied reference video and is used as the default media. The supplied reference video has an envelope + wax-seal opening sequence, so the website starts with a matching cinematic opening experience.

## Files

- `index.html` — public invitation
- `admin.html` — protected admin dashboard
- `styles.css` — public site styling and animations
- `script.js` — public site behaviour and backend integration
- `admin.js` — dashboard behaviour
- `Code.gs` — Google Apps Script API
- `floral-pattern.svg` — decorative botanical background
- `assets/opening-animation.mp4` — opening animation (included supplied video)
- `assets/opening-poster.jpg` — generated poster from the supplied video
- `assets/wedding-video.mp4` — default hero video (included supplied video)

## Important storage rule

Wedding names, photos, videos, dates, venue, theme and invitation content are **not stored in LocalStorage**. The public site requests the current configuration from Google Apps Script on each load with a cache-busting timestamp.

The admin page may keep a temporary admin session token in browser `sessionStorage` only. The admin password itself is never put in frontend code.

## 1. Create the Google Sheet

1. Go to Google Sheets and create a blank spreadsheet.
2. Give it any name, for example `Wedding RSVPs`.
3. Keep the sheet open because we will connect its ID in Apps Script.

## 2. Create the Apps Script backend

1. Open the spreadsheet.
2. Choose **Extensions → Apps Script**.
3. Delete the starter code.
4. Paste the complete contents of `Code.gs`.
5. Save the project.

Because the script is bound to the spreadsheet, the setup helper functions can use the spreadsheet interface.

## 3. Connect the Sheet

In Apps Script, select `setSheetIdFromActiveSpreadsheet` from the function dropdown and press Run.

Approve Google's permission prompts. The function stores the spreadsheet ID in Script Properties and creates an `RSVP` sheet with these columns:

`Timestamp | Guest Name | Status | Number of Attendees | Notes`

## 4. Set the admin password

Run `setAdminPassword` from Apps Script.

A small Google Sheets prompt will ask for the password. Choose a strong password of at least 10 characters. The backend stores only its SHA-256 hash in Script Properties.

## 5. Store the default configuration

Run `initializeDefaultConfig` once. This stores the wedding configuration server-side.

## 6. Deploy the Web App

1. In Apps Script choose **Deploy → New deployment**.
2. Select **Web app**.
3. Execute as: **Me**.
4. Who has access: **Anyone**.
5. Deploy.
6. Authorize the app if Google asks.

The deployment URL in this project is already set to the endpoint supplied for this project:

`https://script.google.com/macros/s/AKfycbwtRTG8R8gndQNv68lyVCE-5xyE4yIgBi5QJove9bGYhvHvMuP1Ek_-P3Eev9vH_zfZ/exec`

For a different deployment URL, update `API_URL` in both `script.js` and `admin.js`.

## 7. Open the admin dashboard

Host the project files and open `admin.html`.

Sign in with the password you configured using `setAdminPassword()`.

The admin dashboard controls:

- Groom and bride names
- Groom / bride / couple image URLs
- Hero video, mobile video, opening video, poster and image URLs
- Wedding date, time, date label, venue, address and Google Maps URL
- Invitation text, Bismillah, quote, RSVP copy, countdown title and footer
- Women's and men's dress code
- Transportation instructions
- Timeline events (add, remove, reorder)
- Pre-wedding events (add, remove, reorder)
- Theme colors, font and decorative style
- RSVP search/filter and attendance totals
- Admin password change

## 8. Dynamic guest name

Share the invitation with a guest URL such as:

`index.html?guest=Guest%20Name`

The guest name is read from the URL at page load. It is not written to LocalStorage or other permanent browser storage.

## 9. Hosting the invitation

Upload these public files to normal static hosting:

`index.html`, `admin.html`, `styles.css`, `script.js`, `admin.js`, `floral-pattern.svg`, and the `assets/` folder.

Examples include GitHub Pages, Netlify, Cloudflare Pages, Vercel static hosting, or any ordinary web host that can serve HTML/CSS/JS/MP4 files.

## 10. Media URLs

For the supplied local defaults, the project uses:

- `assets/opening-animation.mp4`
- `assets/wedding-video.mp4`
- `assets/opening-poster.jpg`

For custom media, place the hosted URL into the admin panel. Do not place large videos into Apps Script Properties. The backend stores only URLs.

## 11. How the opening card works

The opening screen follows the supplied reference video's visual language:

1. Full-screen floral/envelope backdrop.
2. Guest greeting loaded from `?guest=`.
3. Animated invitation card.
4. Burgundy wax seal with dynamic initials (for example Hatem + Nour → HN).
5. Gold particles, glow and shimmer.
6. Tap/click **OPEN INVITATION** or the seal.
7. The seal expands and fades while the card opens.
8. The opening overlay fades away to the main hero.

## 12. Security notes

The frontend does not contain the admin password. Save settings, RSVP list access and password changes require a valid temporary admin token. Tokens expire automatically.

For stronger production hardening, restrict the Apps Script Web App's access to the intended audience and periodically redeploy if you change the Apps Script code.
