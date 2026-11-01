# Putting the site online (Supabase + Vercel)

About 15 minutes, once. After that, every push to the branch updates the live site.

## 1. Supabase (accounts and saved cards)

1. Go to https://supabase.com/dashboard → **New project**. Name it `Spellcraft`, pick a region near you, set a database password (save it somewhere), and create it.
2. When it's ready, open **SQL Editor** → **New query**, paste the whole of `web/supabase/migrations/0001_init.sql`, and click **Run**. This creates the tables, makes every person's data private to them, and adds private storage for art.
3. **Make it invite-only:** **Authentication → Sign In / Providers** → turn **off** "Allow new users to sign up". (Email sign-in stays on.)
4. **Settings → API** (or **Project Settings → Data API**): copy the **Project URL** and the **anon public** key. You'll paste them into Vercel.
5. After Vercel gives you the site address (step 2 below): **Authentication → URL Configuration** → set **Site URL** to that address (e.g. `https://spellcraft-xyz.vercel.app`) and add it under **Redirect URLs** too. Invite and password-reset emails link there.

## 2. Vercel (the website)

1. Go to https://vercel.com/new → **Import Git Repository** → pick `Gotz-exercise-167` (connect GitHub if asked).
2. Settings on the import screen:
   - **Root Directory:** `web`
   - **Framework Preset:** Vite (detected automatically; build settings come from `web/vercel.json`)
   - **Environment Variables:**
     - `VITE_SUPABASE_URL` = the Project URL from Supabase
     - `VITE_SUPABASE_ANON_KEY` = the anon public key
     - `VITE_CONTACT_EMAIL` = optional; an email shown on the About page for rights holders (leave out to hide it)
3. Click **Deploy**. The build downloads the Card Conjurer frames itself, so it takes a minute or two.
4. The work lives on the `ios-card-maker-plan` branch. Either merge it into `master`, or in Vercel go to **Settings → Git → Production Branch** and set it to `ios-card-maker-plan`, then redeploy.

## 3. Invite people

Supabase → **Authentication → Users → Add user → Send invitation**, with their email. They get a link, open the site, choose a password, and they're in. Invite yourself first.

## Privacy notes

- With sign-up turned off, nobody can create an account without an invite.
- The site tells search engines not to list it (`robots.txt`, `noindex` headers).
- The anon key is meant to be public. Security comes from the row level security rules in the SQL file, which only let each signed-in person read and change their own cards, sets and images.
- The card frame images and fonts are ordinary website files. Someone with the exact address could load an individual image without signing in, but the app itself needs a login.
