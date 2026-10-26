# Releasing StudyDock

The Release workflow builds Windows x64, Linux x64, macOS Apple Silicon and macOS Intel, plus a separately named browser-extension ZIP. Each platform runs checks before packaging. Linux and Windows installations also receive smoke checks. No source archive or checksum text file is uploaded by the workflow; GitHub itself always adds its Source code links.

## Prerelease from a feature branch

1. Keep the numeric extension version in `extension/manifest.json` aligned with the release base, for example `1.5.0`.
2. Update `RELEASE_NOTES.md` with the changes, run the checks, and commit/push the feature branch.
3. Tag that commit and push the tag, without merging:

```sh
git tag v1.5.0-rc.1
git push origin v1.5.0-rc.1
```

Supported suffixes are `-alpha.N`, `-beta.N` and `-rc.N`, with N starting at 1. The workflow inserts the full version into the packaged extension's `version_name` and desktop version label. Chrome's numeric `version` stays valid. Prereleases use amber download buttons and never become GitHub's latest stable release.

## Stable releases

Tag a reviewed commit `v1.5.0` after the normal integration process. Stable releases use blue download buttons and become latest. This workflow does not merge branches. Manual workflow dispatch builds artifacts only, with an optional version input; it does not publish.

Publication starts as a draft after every build passes, uploads all packages, then publishes. A failed upload can be rerun while the draft remains. Published releases are not overwritten; use the next version or prerelease number.

## Release notes and buttons

`tools/release_notes.py` combines `RELEASE_NOTES.md` with exact-version download links, the Python installer command, and platform limits. PNGs live in `docs/release-buttons` and are referenced at the release commit SHA. Regenerate them with `python tools/generate_release_buttons.py` after installing the existing development dependencies and Playwright Chromium (`python -m playwright install chromium`). Icons are Google Material icons under Apache 2.0; see `extension/icons/LICENSE-material-icons.txt`.

The extension button links to `StudyDock-VERSION-browser-extension.zip` by default. Once the store listing is public, set repository Actions variable `CHROME_STORE_URL` to its official Chrome Web Store URL. Future release buttons will use it while keeping the exact-version ZIP as a manual-install fallback. Existing release notes can be edited separately.

Desktop assets are the Windows installer and portable ZIP, two macOS DMGs, and the Linux binary. The extension ZIP contains only browser extension files, with `manifest.json` at its root. Private exports and development diagnostics are excluded.

## Website and domain

The website deployment is separate and manual. The source domain is `studydock.himanm.com`; configure its DNS CNAME to `himanm.github.io`, then update the GitHub Pages custom domain and deploy the reviewed site. Publishing a prerelease does not deploy the feature branch website or switch its stable desktop downloads to the prerelease.
