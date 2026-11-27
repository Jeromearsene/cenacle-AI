---
"cenacle-ai": patch
---

The icon of a service now shows up even when none of its accounts has been opened yet (an account outside the grid, for example): the app looks for it on the service's start page, then at `/favicon.ico`, instead of waiting for a page to announce it. Icons that a server labels badly (an `.ico` sent as `application/octet-stream`) are now recognized from their bytes, and multi-size icons up to about 75 KB are accepted.
