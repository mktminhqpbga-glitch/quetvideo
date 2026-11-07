const keys = ["relayUrl", "token", "deviceId", "tabId", "promptSelector", "buttonSelector", "imageSelector"];
const defaults = { deviceId: "chrome-main", promptSelector: "textarea", buttonSelector: "button[type=submit]", imageSelector: "img" };
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
  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) { alert("Site permission was denied"); return; }
  await chrome.storage.local.set(config);
  await chrome.runtime.sendMessage({ type: "connect" });
  window.close();
};
document.getElementById("stop").onclick = async () => {
  await chrome.runtime.sendMessage({ type: "disconnect" }); window.close();
};
load();
