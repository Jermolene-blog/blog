# http://jermolene.com

This is the source code for my blog which you will find at http://jermolene.com.

It is created using TiddlyWiki running under Node.js, generating static HTML files that are hosted on GitHub Pages (for a while the site was generated via Xememex and hosted on Amazon S3).

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

## Contents

This repository contains the following top level folders:

* **archive**: content archived from older versions of jermolene.com
* **artwork**: artwork for favicons, animated gifs etc
* **main-wiki**: the content of the main wiki comprising the blog
* **main-wiki-server**: an indirected version of the main wiki suitable for using in the client-server configuration
* **static-assets**: static assets to the copied unchanged to the output
* **talkytalky-wiki**: the content of the wiki making up http://jermolene.com/talkytalky
* **talkytalky-wiki-server**: an indirected version of the wiki making up http://jermolene.com/talkytalky suitable for using in the client-server configuration

## Batch Scripts

The batch scripts assume a directory layout like this:

```

-+- **Parent**
 |
 +--+- **blog**
    |
    +- **jermolene-blog.github.io**
```

In other words, the folder containing this repository should be a sibling of a folder called "jermolene-blog.github.io" that will contain the output static files.

* **bld.sh**: build all the components of the site, leaving them in the wiki output folders
* **github-push.sh**: push the "jermolene-blog.github.io" folder to GitHub
* **serve.sh**: serve the main wiki at http://127.0.0.1:8080
* **stage.sh**: copy all the output components across to the "jermolene-blog.github.io" folder
* **talkytalky-serve.sh**: serve the talkytalky wiki at http://127.0.0.1:8080
