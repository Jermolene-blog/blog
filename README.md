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
* Each toy describes itself in the `<head>` of its own `index.html`: the caption comes from `<meta name="toy-title">`, falling back to `og:title` and then `<title>`, and the description from `<meta name="toy-description">`, falling back to the standard `description` and then `og:description`. A toy with no description generates a build warning
* The `Toys` page tiddler (tagged `page`, so rendered at `/toys`) lists the tiddlers tagged `toy`, sorted by caption, each with a thumbnail screenshot (see below)
* A folder without an `index.html` is skipped

## Screenshots

Thumbnail screenshots of the toys and other interactive pages are captured automatically by `build-screenshots.js`:

* Every toy in `static-assets/toys` is captured, plus the extra pages listed in `extraTargets` in the script (currently Cecily and the TalkyTalky slides). The screenshot of the page at `/<path>/` is saved as `static-assets/screenshots/<path>.webp`, and so is published at `/screenshots/<path>.webp`
* Pages are loaded into headless Google Chrome, driven over the DevTools protocol so there are no npm dependencies. A page that looks empty when first loaded can be given a recipe in `recipes` in the script that interacts with it before capture (eg Knottery draws a knot, Jpegulator loads its samples). Set `CHROME_PATH` to use a particular Chrome or Chromium
* Screenshots are committed, along with `screenshots.json` which records a hash of each target's files (as seen by git) and recipe. A target is only recaptured when its hash changes, so the script is cheap to run and the CI build normally does not need Chrome. It is run by `bld.sh`; run it by hand after changing a toy so that the new screenshot can be committed. `node build-screenshots.js --force toys/knottery` recaptures a single target regardless of its hash
* If Chrome cannot be found the script warns and leaves existing screenshots alone, and `build-toys.js` omits the thumbnail of any toy without a screenshot
* In posts, `<<screenshot-link "/toys/mimic/" "Screenshot of Mimic">>` renders a thumbnail linking to the page (defined in `$:/Screenshots/Procedures`)

## Contents

This repository contains the following top level folders:

* **archive**: content archived from older versions of jermolene.com
* **artwork**: artwork for favicons, animated gifs etc
* **main-wiki**: the content of the main wiki comprising the blog
* **main-wiki-server**: an indirected version of the main wiki suitable for using in the client-server configuration
* **static-assets**: static assets to be copied unchanged to the output
* **talkytalky-wiki**: the content of the wiki making up http://jermolene.com/talkytalky
* **talkytalky-wiki-server**: an indirected version of the wiki making up http://jermolene.com/talkytalky suitable for using in the client-server configuration

## Batch Scripts

* **bld.sh**: build all the components of the site and assemble the complete static site in the `site` folder, laid out exactly as it is published
* **build-screenshots.js**: capture screenshots of any toys and other pages that have changed (run automatically by `bld.sh`)
* **build-toys.js**: regenerate the tiddlers behind the `/toys` index from the contents of `static-assets/toys` (run automatically by `bld.sh` and `serve.sh`)
* **preview.sh**: build the static site and serve the `site` folder at http://127.0.0.1:8080 (`--no-build` serves the existing build). The built pages use root-relative URLs, so they cannot be viewed by opening the files directly
* **serve.sh**: serve the main wiki at http://127.0.0.1:8080 as an interactive, editable TiddlyWiki (not the static site)
* **talkytalky-serve.sh**: serve the talkytalky wiki at http://127.0.0.1:8080
