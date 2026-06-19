# Test fixtures

Real images only - the suite tests against actual default avatars, never
synthetic ones. Refresh the committed set with:

```sh
node test/fixtures/fetch.mjs
```

`fetch.mjs` pulls from public avatar-generation services (UI Avatars, DiceBear,
placehold.co, Gravatar, GitHub identicons) and real photos (Lorem Picsum). Every
source is generated/served for exactly this purpose or openly licensed, so the
output is safe to commit. Any format works: `.png .jpg .jpeg .gif .webp .svg`.

| Folder | Committed? | Contents | Expected |
| ------ | ---------- | -------- | -------- |
| `initials/` | ✅ yes | white initial on a flat colour | `isDefault: true`, `matched: "initials"` |
| `solidColor/` | ✅ yes | flat solid-colour blocks | `isDefault: true`, `matched: "solidColor"` |
| `personIcon/` | ✅ yes | grey person silhouettes | `isDefault: true`, `matched: "personIcon"` |
| `identicon/` | ✅ yes | symmetric identicon patterns | `isDefault: true`, `matched: "identicon"` |
| `real/` | ✅ yes | real photos | `isDefault: false` |
| `local-default/` | 🚫 git-ignored | any default avatar (sensitive) | `isDefault: true` |
| `local-real/` | 🚫 git-ignored | real photos / faces / PII | `isDefault: false` |

Per-family folders assert both the verdict and which detector matched. The
`local-*` folders are git-ignored - put faces, PII, or anything you can't
publish there; they run on your machine and skip in CI. Empty folders skip, so
clones stay green on whatever subset is present.

Each image becomes its own test, so this doubles as a labelled accuracy check as
the corpus grows.
