# Test fixtures

Drop real images here and the test suite covers them automatically
(`test/fixtures.test.ts`). Any format works: `.png .jpg .jpeg .gif .webp .svg`.

| Folder | Committed? | Put here | Expected verdict |
| ------ | ---------- | -------- | ---------------- |
| `default/` | ✅ yes (public) | generic **default** avatars (Google initial-on-colour, Gravatar identicon/mystery-person, solid placeholders) | `isDefault: true` |
| `real/` | ✅ yes (public) | **real** photos, logos, custom avatars | `isDefault: false` |
| `local-default/` | 🚫 git-ignored | sensitive default avatars | `isDefault: true` |
| `local-real/` | 🚫 git-ignored | sensitive real photos (faces, PII) | `isDefault: false` |

**Only commit images you're OK publishing.** Anything sensitive — real people's
faces, anything you don't have rights to — goes in a `local-*` folder; those are
git-ignored and run only on your machine (and skip in CI).

After adding images:

```sh
pnpm test
```

Each image becomes its own test asserting the detector classifies it correctly,
so this doubles as a labelled accuracy check as the corpus grows.
