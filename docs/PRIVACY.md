# StudyDock privacy policy

Last updated: 25 October 2026.

StudyDock is an independent study tool maintained by [HimanM](https://github.com/HimanM). This policy covers the Chrome extension, the optional desktop exporter and the project website. StudyDock is not affiliated with Udemy, Tutorials Dojo or Google.

## Information used by the extension

To provide review and export features, StudyDock reads content from supported study pages: Udemy practice-test pages, including question content used by the notes editor, and completed View results popups on `portal.tutorialsdojo.com`. This can include questions, answer options, selected answers, correctness labels, explanations, review marks, domain labels, image/reference URLs and test metadata. It also reads open supported study tab titles/URLs and tab-group names to help you select tests. It does not read Chrome's history database or request cookie access.

Notes you write are stored with a short question preview, quiz identifier, question-content fingerprint, question number when available, source URL, title and update timestamp. A content fingerprint is used to match notes to questions; it is not an advertising identifier. Appearance settings, feature settings and a recent review position are also stored.

Question-note editing is available on Udemy pages; the extension reads question content there to attach each note to its question. Tutorials Dojo exports read the completed-result popup in your signed-in browser, including its answer selections, correctness, review flags, explanations, exam title and attempt metadata. The scraper does not export login tokens, cookies or profile details.

## Storage, exports and the optional desktop connection

Notes and extension settings are saved in `chrome.storage.local` in your Chrome profile. StudyDock does not use Chrome Sync for them. Browser exports create files you choose to download. The desktop app saves exports to the selected local folder and stores its own preferences in your user-data directory.

Opening the desktop connection page enables communication with the installed application at `http://127.0.0.1:8765` on the same computer. It sends open supported study tab metadata and, when requested, extracted question data and notes. The connection uses a generated session token and extension-origin checks. It is plain loopback HTTP, not an encrypted HTTPS connection. Closing the connection tab stops its polling. Browser-only review, notes and exports do not require this connection.

StudyDock does not add encryption to notes or exported files. Their protection depends on your browser profile, operating-system account and device security. Other programs with access to those files or your profile may be able to read them.

## External services and sharing

StudyDock has no analytics, advertising, cloud note storage or built-in AI service. The extension and desktop exporter do not send your question exports or notes to the maintainer. They do not sell your data or use it for advertising, credit decisions or unrelated profiling. They do not read your Udemy or Tutorials Dojo password or authentication cookies.

Displaying a course image may request that image from its original host, including Udemy or Tutorials Dojo, when opening a saved HTML review. HTML files contain their review interface, questions, explanations and exported notes; linked course images still need internet. Following a reference, support, download or GitHub link connects your browser to that service, whose own privacy policy applies. StudyDock does not control Udemy's, Tutorials Dojo's or GitHub's data practices. If you later upload an exported file to an LLM or another service, that is a separate action under that service's terms.

The optional Python installer contacts GitHub to fetch release metadata and a verified desktop package. Public release downloads need no token. You can optionally provide `GH_TOKEN` or `GITHUB_TOKEN` to download from a private repository. The installer does not save that token, forward it to another download host, or pass it to the downloaded installer. This installer is separate from the Chrome extension.

## Website

The product website has no analytics or advertising scripts. It uses browser platform information locally to suggest a desktop download; it cannot reliably determine every CPU architecture or Linux compatibility detail. You can choose another platform manually. Theme preference is saved in the site's local storage. Interactive example notes are held in page memory and are discarded when the page reloads. Website demonstrations use illustrative content and do not access your Udemy or Tutorials Dojo tabs.

The website host and linked download providers receive normal web requests, including information such as IP addresses and browser headers. Hosting-provider logging is governed by that provider's policy. The site does not intentionally send demo notes to a server.

## Retention and deletion

Extension notes and settings remain until you change or remove them, clear the extension's storage, or uninstall the extension. Clearing a note removes its text from notes-only exports; minimal question metadata can remain in extension storage. To remove all stored note metadata, clear the extension's storage or uninstall it. Export a backup first if you need to retain your notes.

Downloaded and desktop-exported files remain until you delete them yourself. Uninstalling the extension does not delete those files or the desktop application's preferences. Remove the desktop user-data folder if you also want to remove its saved preferences and default export files; custom export folders must be handled separately. Website theme preference can be removed by clearing the site's local storage.

## Contact and changes

Contact the maintainer through the [StudyDock repository](https://github.com/HimanM/StudyDock) or the contact channels on [HimanM's profile](https://github.com/HimanM). Do not post private course exports, credentials or personal notes in a public issue. The policy will be updated if StudyDock's data handling changes; the date above identifies this version.
