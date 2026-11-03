# Copperline Studio website, with a built-in content editor (CMS)

A photo, film and design studio website in HTML, CSS and JavaScript, plus a visual editor
that lets the business owner change every word, photo, service, project and question
without touching code. No database is needed.

```
copperline/
├── index.html            The website (a template; all content is loaded from content/)
├── css/styles.css        Website design
├── js/main.js            Website behaviour; renders everything from the content file
├── content/
│   ├── content.js        ← ALL website content. The editor rewrites this file when you publish.
│   └── content.json      Same content as plain JSON (the editor keeps both in sync)
├── images/               Starting images (placeholders: replace them in the editor)
├── uploads/              Images uploaded through the editor
├── admin/                The editor (opens over the site at yoursite.com/#admin or /admin)
├── api/                  PHP: sign-in, saving, image uploads, booking form, enquiries
└── data/                 Private: password, enquiries, automatic backups (blocked from the web)
```

## Hosting requirements

Any ordinary web hosting with **PHP 7.4 or newer** (cPanel, Plesk, DirectAdmin and most Zambian hosts).
No database, no Node, no build step.

## Install (10 minutes)

1. Upload everything inside the `copperline` folder to your web root (usually `public_html`).
2. Make sure these folders are writable by PHP (permission **755**, or **775** on some hosts):
   `content/`, `uploads/`, `data/`.
3. Visit **yoursite.com/admin**. The editor asks for a **setup code**.
4. In your hosting **File Manager**, open `data/setup-code.txt`, copy the code, and paste it into the editor.
   Choose a password (10+ characters). The code works once and is then deleted.
5. Edit, then press **Publish**. Visitors see the new version straight away.

Use HTTPS (free Let's Encrypt certificates are in most hosting panels) so the password travels encrypted.

## What the client can edit

| Editor tab | What it controls |
|---|---|
| Brand & contact | Business name, tagline, Google description, email, phone, WhatsApp, location, hours, Instagram/Facebook/TikTok/YouTube |
| Opening slideshow | Headline lines, buttons, and each slide's coloured word, photo, caption and focus point |
| Studio intro | Intro paragraph, coloured phrases, fact cards |
| Services | Every service card: name, group, card size, photo, description, what's included |
| Work | Categories (filter buttons) and every project: photo, video link, length, location, description, "selected work" tick |
| Before & after | The comparison slider images, text and setting chips (can be hidden) |
| Graphic design | Design pieces (can be hidden) |
| Content & marketing | Steps and the phone content-calendar (can be hidden) |
| How we work | Process steps |
| Questions | FAQ questions and answers |
| Booking form | Form text, budget options, towns for the best-light planner |
| Footer | Banner headline, button, copyright line |
| Enquiries | Every booking sent from the website, with a WhatsApp button and delete |

Lists can be added to, reordered, duplicated and deleted. Photos are resized in the browser before upload
(max 2400 px) so phone photos upload quickly and the site stays fast.

## Enquiries

The booking form posts to `api/enquiry.php`, which:
- saves the enquiry for the editor's **Enquiries** tab, and
- emails it to the address in **Brand & contact** (uses the host's `mail()`; most cPanel hosts support it.
  If emails don't arrive, check spam and create a mailbox for that domain in your hosting panel).

Spam protection: a hidden honeypot field and a limit of 5 enquiries per 10 minutes per visitor.
To use Formspree or similar instead, paste its URL into **Brand & contact → Custom form address**.

## Security

- One admin password, stored as a bcrypt/argon hash in `data/auth.json`. First-time setup needs a one-time code from the server.
- Sessions are HttpOnly, SameSite=Strict, and expire after 2 hours idle or 12 hours total. Every change needs a CSRF token.
- Sign-in is limited to 6 attempts per 15 minutes per visitor.
- Uploads must be real JPG/PNG/WebP images; `uploads/.htaccess` stops any script from running there.
- `data/.htaccess` blocks web access to private files on Apache/LiteSpeed. **On Nginx**, add
  `location ^~ /data/ { deny all; }` or set the environment variable `CMS_DATA_DIR` to a folder outside the web root.
- Every publish keeps the previous version in `data/backups/` (last 30). The editor also has
  **⋯ → Download a backup** and **Restore from a backup**.

## Forgot the password?

Delete `data/auth.json` in the File Manager, then visit `/admin` again. A new setup code appears in `data/setup-code.txt`.

## Without PHP

Opened from a computer or a host without PHP, the editor runs in **demo mode**: changes are kept in that browser only.
It is useful to try the editor, but visitors won't see the changes until the site runs on PHP hosting.

## Developer notes

- `window.SITE_CONTENT` (content/content.js) is the single source of truth. `js/main.js` exposes `Site.render(content)`;
  the editor calls it on every keystroke for a live preview.
- To add a new editable field: add it to `content.json`, display it in `main.js` (or with a `data-c="section.key"`
  attribute in `index.html`), and add it to the `SCHEMA` list at the top of `admin/admin.js`.
