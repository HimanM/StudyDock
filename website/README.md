# StudyDock website

A single-page Next.js static export using Material UI components, Material icons and a self-hosted Roboto font. There is no runtime server, database, analytics SDK or remote demo API. The site uses the existing StudyDock artwork and screenshots of the actual extension with synthetic questions.

## Develop and build

Node 22+ and npm are needed only for development/building. From `website/`:

```sh
npm ci
npm run dev
```

Open the localhost address printed by Next.js. For deployable files:

```sh
npm test
npm run build
```

Upload the contents of `out/` to a static host. Do not upload `node_modules`, the repository or `.next`. For local inspection of the exported build, run `python -m http.server 4173 --directory out` and open `http://localhost:4173`.

The build follows [Next.js static-export guidance](https://nextjs.org/docs/app/guides/static-exports) and [Material UI's App Router integration](https://mui.com/material-ui/integrations/nextjs/).

## Configuration

Environment variables are read when building, not when serving the exported files.

| Variable | Default / behavior |
| --- | --- |
| `NEXT_PUBLIC_BASE_PATH` | Empty for `udemystudytool.himanm.com`. Set `/Udemy-Study-Tools` only when building for the GitHub project URL without the custom domain. No trailing slash. |
| `NEXT_PUBLIC_SITE_URL` | Set the complete deployed homepage URL with a trailing slash to generate absolute social-preview image URLs. No assumed public deployment is embedded when unset. |
| `NEXT_PUBLIC_CHROME_STORE_URL` | Empty until the extension is published. Only an HTTPS `chromewebstore.google.com/detail/…` URL activates the store-install CTA. Otherwise it downloads GitHub's repository ZIP; the page explains selecting its `extension` folder in Chrome. |
| `NEXT_PUBLIC_REPO_PRIVATE` | `true`. Set `false` after making the GitHub repository public, to remove the private-download access note. This does not change repository visibility. |
| `NEXT_TELEMETRY_DISABLED` | Set `1` to disable Next.js build-tool telemetry. The published website has no Next.js runtime server. |

The current desktop version is deliberately `1.4.3` in `lib/config.js`, matching the published app packages. The source extension can have a newer version. When a new desktop release is actually published, update that constant and rebuild. Download URLs are direct GitHub release URLs; they are not fabricated store links.

### Custom domain: udemystudytool.himanm.com

The **Website** workflow tests/builds on relevant pushes and PRs. It uploads a static artifact without publishing it. Deployment is manual:

1. Configure **Settings → Pages → Source → GitHub Actions**. GitHub Pages for a private repository requires an eligible GitHub plan; otherwise make the repository public when you choose. This workflow does not change repository visibility.
2. Add repository variable `CHROME_STORE_URL` only after Chrome approves and publishes the actual store item; it is optional before then.
3. Run **Actions → Website → Run workflow**, choosing **Publish to GitHub Pages**.
4. Set the Pages custom domain to `udemystudytool.himanm.com`. In Cloudflare DNS, add a **CNAME** named `udemystudytool` with target `himanm.github.io`, initially **DNS only**. GitHub may also request domain verification; follow the exact TXT record it gives you rather than inventing a token.
5. After DNS validation and certificate provisioning, enable **Enforce HTTPS** in Pages. The repository's `public/CNAME` also records the requested hostname.
6. Verify `https://udemystudytool.himanm.com/`, download links and `/privacy/` while signed out before using those URLs in a public store listing. The site can be public while release/source downloads still require access to this private repository.

The workflow builds for the custom domain at `/`, with absolute social-preview URLs under `https://udemystudytool.himanm.com/`. For a different host, build with the appropriate base path/site URL and upload `out/`. DNS access is separate from GitHub repository access; committing the CNAME file alone does not create the DNS record.

## Content and behavior

- `app/page.jsx` contains the page's content and section layout.
- `components/` contains the working demo, screenshot viewer, theme controls and download selector.
- `lib/config.js` contains release URLs and OS detection; Mac chip and Linux libc compatibility are not inferred from the browser.
- `lib/demo.js` contains illustrative questions and the example Markdown/JSON serializer. Demo notes are held only in memory until reload.
- `components/Privacy.jsx` renders `../docs/PRIVACY.md` at build time on `/privacy/`. Both homepage Privacy links open that page, which also works without JavaScript. The homepage's existing `#privacy` anchor remains a short introduction with a policy link.
- `public/images/` contains the product previews and app icon. No personal Udemy screenshot or real course export is used.

The default theme follows the system. A manual choice is saved in the site's local storage. All icons come from `@mui/icons-material`; interface components use `@mui/material`. Custom layout CSS uses the same surface/color palette. Reduced motion is respected. Navigation, controls and screenshot dialogs are keyboard accessible.

## Checks

Pure logic checks: `npm test`.

The browser checks use the repository's Python Playwright development dependency and a temporary standard-library HTTP server. From the repository root, after building:

```sh
python -m playwright install chromium
python website/test_site.py
```

On this Windows workspace, installed Chrome can be used instead: set `USE_CHROME=1` in the process environment. Set `SCREENSHOTS=1` to save responsive captures under the ignored `.dev-previews/` folder. If testing a base-path build, give the test the same `NEXT_PUBLIC_BASE_PATH` value as the build.

Checks cover 390/768/1440 px layouts, mobile navigation, dark/light persistence, OS suggestions, Mac manual selection, per-question notes, real Markdown/JSON downloads, screenshot dialogs, privacy text, failed requests, console exceptions and reduced motion. Product screenshots are maintained locally using synthetic questions; published copies live in `public/images/`.

No Chrome Web Store submission or public website deployment is performed by these tests.
