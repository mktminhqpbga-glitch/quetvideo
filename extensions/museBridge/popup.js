const keys = ["relayUrl", "pairingCode", "deviceId", "tabId", "promptSelector", "buttonSelector", "imageSelector"];
const defaults = { relayUrl: "https://mooz-relay.onrender.com", deviceId: "chrome-main", promptSelector: "textarea", buttonSelector: "button[type=submit]", imageSelector: "img" };
async function load() {
  const config = { ...defaults, ...await chrome.storage.local.get([...keys, "bridgeState", "bridgeMessage"]) };
  for (const tab of await chrome.tabs.query({})) {
    if (!/^https?:/.test(tab.url || "")) continue;
    const item = document.createElement("option");
    item.value = tab.id; item.textContent = (tab.title || new URL(tab.url).hostname).slice(0, 65);
    document.getElementById("tabId").append(item);
  }
  for (const key of keys) document.getElementById(key).value = config[key] ?? "";
  document.getElementById("status").textContent = "Status: " + (config.bridgeState || "disconnected") + " " + (config.bridgeMessage || "");
}
document.getElementById("save").onclick = async () => {
  const config = Object.fromEntries(keys.map(key => [key, document.getElementById(key).value.trim()]));
  if (!config.tabId) { alert("Select the Muse tab first"); return; }
  const tab = await chrome.tabs.get(Number(config.tabId));
  const origin = new URL(tab.url).origin + "/*";
  const relay = new URL(config.relayUrl);
  if (relay.protocol !== "https:" && !(relay.protocol === "http:" && ["localhost", "127.0.0.1"].includes(relay.hostname))) {
    alert("Relay URL must use HTTPS"); return;
  }
  const granted = await chrome.permissions.request({ origins: [origin, relay.origin + "/*"] });
  if (!granted) { alert("Site permission was denied"); return; }
  const previous = await chrome.storage.local.get(["deviceId", "relayUrl"]);
  if (config.pairingCode || previous.deviceId !== config.deviceId || previous.relayUrl !== config.relayUrl) await chrome.storage.local.remove("resumeToken");
  await chrome.storage.local.set(config);
  await chrome.runtime.sendMessage({ type: "connect" });
  window.close();
};
document.getElementById("stop").onclick = async () => {
  await chrome.runtime.sendMessage({ type: "disconnect" }); window.close();
};
load();
