// background.js (MV3 service worker)

const MAX_SLOTS = 9;
const STORAGE_KEY = "slots";
const SETTINGS_KEY = "settings";

/** "current" | "newTab" | "newWindow" (default: "newTab") */
async function getOpenMode() {
  const { settings = {} } = await chrome.storage.sync.get(SETTINGS_KEY);
  return settings.openMode || "newTab";
}

async function openUrlWithMode(url, mode) {
  const openMode = mode || (await getOpenMode());
  try {
    switch (openMode) {
      case "current": {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab?.id) {
          try {
            await chrome.tabs.update(activeTab.id, { url });
          } catch {
            await chrome.tabs.create({ url });
          }
        } else {
          await chrome.tabs.create({ url });
        }
        break;
      }
      case "newWindow":
        await chrome.windows.create({ url, focused: true });
        break;
      case "newTab":
      default:
        await chrome.tabs.create({ url });
    }
  } catch {
    await chrome.runtime.openOptionsPage();
  }
}

async function openSlot(slotIndex) {
  const [{ slots = {} }, globalMode] = await Promise.all([
    chrome.storage.sync.get(STORAGE_KEY),
    getOpenMode(),
  ]);

  const key = `slot_${slotIndex}`;
  const entry = slots[key];

  if (!entry || !entry.enabled || !entry.url) {
    await chrome.runtime.openOptionsPage();
    return;
  }

  const modeToUse =
    entry.openMode && entry.openMode !== "inherit" ? entry.openMode : globalMode;

  await openUrlWithMode(entry.url, modeToUse);
}

chrome.commands.onCommand.addListener((command) => {
  if (!command.startsWith("open_bookmark_")) return;
  const n = parseInt(command.replace("open_bookmark_", ""), 10);
  if (Number.isInteger(n) && n >= 1 && n <= MAX_SLOTS) openSlot(n);
});

// Allow Options page "Test" to reuse the same logic
chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
  if (req?.type === "openUrl" && req.url) {
    (async () => {
      await openUrlWithMode(req.url, req.mode); // mode already resolved by Options UI
      sendResponse({ ok: true });
    })();
    return true;
  }
});
