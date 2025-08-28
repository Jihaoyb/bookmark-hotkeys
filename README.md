# Bookmark Hotkeys (Chrome Extension, MV3)

Quickly open your favorite sites with keyboard shortcuts. Configure slots in a minimal, Linear-style options page: pick a bookmark (or “Customize” for any URL), choose how it opens (current tab / new tab / new window), and test instantly.

![screenshot](screenshot.png)

## Features
- Per-slot bookmark picker (with favicon + site name) or **Customize** any URL
- Global default open behavior + per-slot override
- Add/remove slots dynamically
- Clear “Test” & “Delete” actions
- Debounced, instant saves (no extra “Save” button)
- Resilient favicons (built-in + web fallbacks)

> Note: Chrome requires binding keyboard shortcuts on the official page (`chrome://extensions/shortcuts`). The Options page mirrors your current bindings and links you there.

## Installation (Developer Mode)
1. **Clone** this repo  
    ```bash
    git clone https://github.com/<you>/<repo>.git
    cd <repo>
2. Open chrome://extensions → toggle Developer mode (top right).
3. Click Load unpacked → select this folder (the one containing manifest.json).

## Usage
1. lick the extension’s Options.
2. Add slot → pick a bookmark (or select Customize to enter a URL).
3. Choose open behavior (inherit/global, current tab, new tab, or new window).
4. Press Test to verify it opens the way you want.
5. (Optional) Assign keyboard shortcuts at chrome://extensions/shortcuts.

## Permissions (Why they’re needed)
- bookmarks – read your bookmarks for the picker
- storage – save your settings (URLs, modes)
- tabs / windows – open URLs the way you select
- commands – listen for keyboard shortcuts

## Privacy
- No data is sent off-device. All settings live in Chrome sync storage.