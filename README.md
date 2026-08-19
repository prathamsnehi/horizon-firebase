# horizon-firebase

The Firebase backend for **Horizon** — an app that turns who you are into
real-world quests just past the edge of your comfort zone.

Give it a profile, it returns three quests tied to real places near you, each
with a photo. Or one quest from a sentence you typed.

The iOS app lives in its own repo. This one holds the Cloud Functions, the
Firestore config, and a static coming-soon page.

## Docs

| | |
|---|---|
| [docs/developer/](docs/developer/) | **Start here.** Commands, secrets, what's left before launch |
| [docs/api/](docs/api/) | The wire contract between app and backend |
| [docs/agent/](docs/agent/) | Deep technical context, written for AI agents working in this repo |
| [docs/frontend/](docs/frontend/) | iOS client data models |

## Quick start

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"   # if node isn't found
cd functions
npx jest
```
