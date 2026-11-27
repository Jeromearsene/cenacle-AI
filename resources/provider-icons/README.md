# Service icons

Icons shown next to each service in the sidebar. A service with a file here uses it as is: nothing
is fetched from the network, and the icon is there from the first frame. A service without one
falls back to the favicon its site announces (see `src/main/provider-icons.ts`).

Name each file after the id of the service (see `src/main/providers.ts`), with one of these
extensions: `svg`, `png`, `webp`, `ico`, `jpg`, `gif`:

| Service    | File             |
| ---------- | ---------------- |
| Claude     | `claude.png`     |
| ChatGPT    | `chatgpt.png`    |
| Gemini     | `gemini.png`     |
| Perplexity | `perplexity.svg` |

A bitmap is 128 × 128 px with a transparent background (the sidebar shows them at 16 to 22 px,
so this is sharp on a high-density screen). When adding a service in `src/main/providers.ts`,
add its icon here: a test checks that every service has one.

Keep them small (a few KB; 75 KB is the limit). The icons are drawn on a light tile, so a dark
icon stays readable in the dark theme. These marks belong to their owners: take them from each
company's own brand kit, and follow its terms.
