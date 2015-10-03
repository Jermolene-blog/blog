# http://jermolene.com

This is the source code for my blog which you will find at http://jermolene.com.

It is created using TiddlyWiki running under Node.js, generating static HTML files that are hosted in GitHub Pages.

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
