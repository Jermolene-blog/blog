# http://jermolene.com

This is the source code for my blog which you will find at http://jermolene.com.

It is created using TiddlyWiki running under Node.js, generating static HTML files that are hosted on GitHub Pages (for a while the site was generated via Xememex and hosted on Amazon S3).

Pushing to `master` triggers a GitHub Actions workflow (`.github/workflows/build.yml`) that runs `bld.sh` and publishes the resulting `site` folder to the [jermolene-blog.github.io](https://github.com/Jermolene-blog/jermolene-blog.github.io) repository.

The main wiki uses the `tiddlywiki/static` plugin (vendored in `main-wiki/plugins/static`) to render tiddlers as slugified, extensionless HTML files, plus a "tiddler river" of all posts at `/index.html`.

## URL Scheme

The mapping from tiddler title to site path is centralised in the filter in `$:/config/static/route-filter` (in `main-wiki/tiddlers/system`), which is used by the build filters in `tiddlywiki.info`, the static plugin's link generation, and the `_canonical_uri` template:

* Tiddlers tagged `post` are rendered at `/post/<slug>` (eg `/post/introducing-cecily`)
* Tiddlers tagged `page` are rendered at the root (eg `/about`, `/archive`)
* Content images are saved at `/images/<slug>`
* Interactive toys live at `/toys/<name>` and preserved old sites at `/archive/<name>`, both copied verbatim from `static-assets`
* The full interactive wiki is at `/wiki/`

GitHub Pages has no server-side redirects, so old URLs are covered by meta-refresh stub pages: the build renders one at each post's legacy root-level slug, and `static-assets` contains hand-written stubs at the old toy locations (`/mimic`, `/lenticulator`, `/engravery`, `/cecily`, `/fridgywiki`). Note that `/mimic` deliberately redirects to the toy at `/toys/mimic/`, not the post; static assets are copied after the wiki output and overwrite it on conflict.

All rendered pages carry a `rel=canonical` link derived from the route filter and the base URL in `$:/config/static/base-url`.

## Toys

Each toy is a self-contained folder under `static-assets/toys`, published verbatim at `/toys/<name>` and reached from the "Toys" item in the top menu. The index page at `/toys` is generated from the folder listing, so adding, renaming or re-describing a toy requires no other change:

* `build-toys.js` scans `static-assets/toys/*/index.html` and writes one tiddler per toy, tagged `toy`, to `main-wiki/tiddlers/generated/toys.json`. It is run automatically by `bld.sh` and `serve.sh`, and its output is committed so that the wiki also builds without it
* Each toy describes itself in the `<head>` of its own `index.html`: the caption comes from `<meta name="toy-title">`, falling back to `og:title` and then `<title>`, and the description from `<meta name="toy-description">`, falling back to the standard `description` and then `og:description`. A toy with no description generates a build warning. `<meta name="toy-tagline">` gives a shorter line for its social media card (see below)
* The `Toys` page tiddler (tagged `page`, so rendered at `/toys`) lists the tiddlers tagged `toy`, sorted by caption, each with a thumbnail screenshot (see below)
* A folder without an `index.html` is skipped

Most toys are edited in place, so their folder in `static-assets/toys` is their source. Toys that are built from source, and toys that came with tools, tests or working notes, keep those in `toys-src/<name>/` (see `toys-src/README.md`). A built toy's `index.html` starts with a comment naming the script that builds it; edit the source, rebuild and commit both. The CI build doesn't run these builds: it publishes the committed toys.

## Progressive Web Apps

The `/toys` index and each toy can be installed as apps and work offline. Installing the index gives one app containing every toy; installing a toy gives an app of that toy alone. Each toy's `index.html` carries `<link rel="manifest" href="manifest.webmanifest">`, `<meta name="theme-color">`, `<link rel="apple-touch-icon">` and `<script src="../pwa.js" defer>`, and the generated index page carries the equivalent (from `$:/_Toys/PWA` and `$:/_Toys/PWA.js` in `main-wiki/tiddlers/system`):

* `build-pwa.js` runs at the end of `bld.sh`, after the site has been assembled, and writes into `site/` the web app manifest for the index (`/toys/manifest.webmanifest`, which lists the toys as shortcuts) and for each toy (`/toys/<name>/manifest.webmanifest`, with the name, description and colours from the toy's `<meta>` tags via `toys.json`), plus `/toys/precache.js`, the list of files the service worker caches along with a version hashed from their contents. These are build outputs and are not committed
* `static-assets/toys/sw.js` is the single service worker, registered by `static-assets/toys/pwa.js` from the index and from every toy. Its scope is `/toys/`, so whichever page is visited first makes the whole collection available offline. On installation it precaches everything under `/toys` (except source maps, licences and images over 512KB, such as the Lenticulator's sample photographs, which are cached as they are first used) together with the index page's stylesheet, banner and screenshots, and fetches the toys' third party scripts and fonts on a best-effort basis. Any change to the toys changes `precache.js`, and the browser then installs the new version into a fresh cache
* `pwa.js` also shows a small "back to the toys" button in the bottom-left corner of a toy that was opened from the installed index app, and gives the menu's link to `/toys` its trailing slash so that it stays within the worker's scope. Opened from disk, it does nothing
* Icons are hand-drawn as `icon.svg` in `static-assets/toys` (the index) and in each toy's folder, and `build-icons.sh` renders them to the committed `icon-192.png`, `icon-512.png` and `apple-touch-icon.png` with `rsvg-convert` (`brew install librsvg`). The artwork keeps to the central 80% so the same files serve as maskable icons. A new toy needs an `icon.svg` and a `theme-color` meta tag, and optionally `<meta name="toy-short-title">` for a name short enough for a home screen; `build-toys.js` and `build-pwa.js` warn when they are missing

To try it locally, run `preview.sh` and open http://127.0.0.1:8080/toys/ (service workers need `http://localhost`, `127.0.0.1` or HTTPS).

## Screenshots

Thumbnail screenshots of the toys and other interactive pages are captured automatically by `build-screenshots.js`:

* Every toy in `static-assets/toys` is captured, plus the extra pages listed in `extraTargets` in the script (currently Cecily and the TalkyTalky slides). The screenshot of the page at `/<path>/` is saved as `static-assets/screenshots/<path>.webp`, and so is published at `/screenshots/<path>.webp`
* Pages are loaded into headless Google Chrome, driven over the DevTools protocol so there are no npm dependencies. They are rendered at twice the resolution of the screenshot, so that a close-up of the most interesting part of each page, set in `closeups` in the script, can be captured at the same time for its social media card. Close-ups are saved in `social/closeups/`, which is committed but not published. A page that looks empty when first loaded can be given a recipe in `recipes` in the script that interacts with it before capture (eg Knottery draws a knot, Jpegulator loads its samples). Set `CHROME_PATH` to use a particular Chrome or Chromium
* Screenshots are committed, along with `screenshots.json` which records a hash of each target's files (as seen by git) and recipe. A target is only recaptured when its hash changes, so the script is cheap to run and the CI build normally does not need Chrome. It is run by `bld.sh`; run it by hand after changing a toy so that the new screenshot can be committed. `node build-screenshots.js --force toys/knottery` recaptures a single target regardless of its hash
* If Chrome cannot be found the script warns and leaves existing screenshots alone, and `build-toys.js` omits the thumbnail of any toy without a screenshot
* In posts, `<<screenshot-link "/toys/mimic/" "Screenshot of Mimic">>` renders a thumbnail linking to the page (defined in `$:/Screenshots/Procedures`)

## Social Media Cards

Every toy, post and page has a card, the 1200x630 picture shown when a link to it is shared on social media, with a close-up of its most interesting part beside its title and a line or two about it. The cards are drawn by `build-social.js`:

* A toy's card has its close-up (see Screenshots above), its caption, its `<meta name="toy-tagline">` and its `theme-color`
* A post's or page's card has its caption or title and its `description` field, beside the close-ups listed in its `social-closeup` field (eg `toys/mimic`, or several for a grid), or else the image tiddler named in its `social-image` field (cropped by `social-image-clip`, "<x> <y> <width> <height>" in the image's pixels), or else the site banner. The wiki lists them for the script in `$:/_Social/Cards`. A post without a description gets the home page's
* The card for the page at `/<path>` is saved as `static-assets/social/<path>.jpg` (the home page's is `index.jpg`). A square picture sits beside the text; a wide one goes across the top
* Like the screenshots, cards are committed along with `social.json`, which records a hash of each card's text and pictures, and only redrawn when that changes. `node build-social.js --force post/mimic` redraws one regardless
* `$:/_Social/Meta` writes the `og:` and `twitter:` tags into every page of the wiki. The toys are published verbatim, so `node build-social.js --tags` adds theirs to the copies in `site/` after it is assembled
* To check a card, paste the page's address into a preview tool such as https://www.opengraph.xyz once it is published

## Contents

This repository contains the following top level folders:

* **archive**: content archived from older versions of jermolene.com
* **artwork**: artwork for favicons, animated gifs etc
* **main-wiki**: the content of the main wiki comprising the blog
* **social**: the close-ups that the social media cards are drawn from
* **main-wiki-server**: an indirected version of the main wiki suitable for using in the client-server configuration. Its `$:/config/FileSystemPaths` files the tiddlers it saves into `main-wiki/tiddlers`: posts in `posts`, pages in `pages`, images in `images`, system tiddlers in `system` and anything else at the top level, while drafts and the story list go in `new`, which is not committed
* **static-assets**: static assets to be copied unchanged to the output
* **toys-src**: source, build scripts, tests and working notes for the toys that need more than their published files
* **local** (not committed): private material that must never be published, such as the original cat photographs read by `build-cat-sprites.sh`. Back it up separately
* **talkytalky-wiki**: the content of the wiki making up http://jermolene.com/talkytalky
* **talkytalky-wiki-server**: an indirected version of the wiki making up http://jermolene.com/talkytalky suitable for using in the client-server configuration

## Setting up a new machine

1. Clone this repository, and install Node.js 22 or later and Python 3
2. Install TiddlyWiki from its master branch, as the CI build does: clone https://github.com/TiddlyWiki/TiddlyWiki5 alongside this repository and run `npm install -g ./TiddlyWiki5` (or `npm link` inside it). `./bld.sh` then builds the site and `./preview.sh` serves it
3. For screenshots, install Google Chrome. For icons, `brew install librsvg`. For the cat sprites, ImageMagick and cwebp (`brew install imagemagick webp`) and the Xcode command line tools
4. For the toys' tests: `cd toys-src && npm install && npx playwright install chromium`
5. Export the original cat photos from Apple Photos into `local/cats/` (only needed to rebuild the cat sprites)

## Writing in a Codespace

Posts can be written from any browser, such as on an iPad, in a GitHub Codespace defined by `.devcontainer/devcontainer.json`:

1. On https://github.com/Jermolene/blog choose Code, then Codespaces, then open a codespace on `master` (the first one takes a few minutes to set up; after that, reopen the same one from the same menu)
2. The codespace runs `serve.sh` and forwards its port. Open the editable wiki from the globe icon beside port 8080 in the Ports panel (if the browser blocks the tab that opens automatically). The address is private to your GitHub account, and can be added to the iPad's Home Screen
3. Write the post as usual, tagged `post` and with a `description`. Pictures can be imported from Photos with the import button in the sidebar's Tools tab
4. Commit and push from the Source Control panel. The push triggers the CI build and deploy as usual

The CI build draws the social media card of a new post, but as it is not committed it is redrawn by every build until the next time the site is built on a Mac and the card committed. Codespaces stop when they have been idle for a while, keeping uncommitted work, and can be deleted once everything has been pushed.

## Batch Scripts

* **bld.sh**: build all the components of the site and assemble the complete static site in the `site` folder, laid out exactly as it is published
* **build-screenshots.js**: capture screenshots of any toys and other pages that have changed (run automatically by `bld.sh`)
* **build-toys.js**: regenerate the tiddlers behind the `/toys` index from the contents of `static-assets/toys` (run automatically by `bld.sh` and `serve.sh`)
* **build-pwa.js**: generate the web app manifests and service worker precache list that make the toys installable (run automatically by `bld.sh`)
* **build-icons.sh**: render the PNG app icons from each `icon.svg` (run by hand after changing an icon)
* **preview.sh**: build the static site and serve the `site` folder at http://127.0.0.1:8080 (`--no-build` serves the existing build). The built pages use root-relative URLs, so they cannot be viewed by opening the files directly
* **serve.sh**: serve the main wiki at http://127.0.0.1:8080 as an interactive, editable TiddlyWiki (not the static site)
* **talkytalky-serve.sh**: serve the talkytalky wiki at http://127.0.0.1:8080
