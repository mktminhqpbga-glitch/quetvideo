# ToonFlow + existing MooZ Render relay

Target: `https://mooz-relay.onrender.com` (repository `mktminhqpbga-glitch/app-mooz`). This is NOT the separate `toonflow-chrome-relay` service.

## Security: one RELAY_ADMIN_KEY, no admin key in Chrome

The existing Render environment variable `RELAY_ADMIN_KEY` is **reused** to authenticate the ToonFlow backend when it submits and polls image jobs. The MooZ `/remote` protocol is left unchanged. Chrome uses a **short-lived pairingCode** and, after successful pairing, an automatically rotated resumeToken. Never paste `RELAY_ADMIN_KEY` into Chrome, share it in messages, or commit it to GitHub.

## 1. Enable the gateway on the existing Render service

The relay code lives in `mktminhqpbga-glitch/app-mooz/relay-server`. After merging the MooZ gateway change, deploy the new `app-mooz` commit using **Render → mooz-relay → Manual Deploy → Deploy latest commit**. Auto Deploy is disabled in that repo. **Manual deployment restarts the existing relay** and clears MooZ's in-memory rooms, so reconnect any existing MooZ/Workflow Connect sessions afterward. Do not change the existing environment variable or create another web service.

Expected public check: `https://mooz-relay.onrender.com/health` still shows `mooz-outbound-relay`. `/toonflow/devices` requires admin authentication.

## 2. Get a one-time pairing code on your own computer

On macOS/Linux terminal (with your own admin key available as an environment variable), generate a code for `chrome-main`:

```sh
curl --fail-with-body -sS -X POST "https://mooz-relay.onrender.com/toonflow/pairings" \
  -H "Authorization: Bearer $RELAY_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"chrome-main"}'
```

The response contains `pairingCode` and `expiresAt` (10-minute invitation). Do **not** send the key here. Use the one-time `pairingCode` in Chrome, not the admin key. If your shell does not already have `RELAY_ADMIN_KEY`, enter it privately with a hidden-input prompt or a local secret manager first. Remove the variable when done.

## 3. Connect Chrome (local, other PC, or VM)

1. Download the `quetvideo` repo ZIP, extract it, and open `chrome://extensions`.
2. Turn on **Developer mode** and choose **Load unpacked** → `extensions/museBridge`.
3. Sign in to Muse yourself in a normal Chrome tab.
4. In the extension popup set relay URL `https://mooz-relay.onrender.com`, the one-time pairing code, a unique deviceId such as `chrome-main` or `chrome-vm-01`, and select the Muse tab. The extension will request permission for the selected tab and relay origin.
5. Configure the prompt, Generate button, and result image CSS selectors according to the *actual Muse UI*. The defaults are examples and are not verified against Muse.
6. Press **Save & connect**. On successful pairing the extension stores a separate resume token, clears the one-time code, and can reconnect after transient network drops. Render restart loses pairing sessions; create a new code if it reports `pairing-required`.

## 4. Configure ToonFlow

In the ToonFlow desktop/web application, select the built-in media provider **Muse via Chrome Extension (Render)** and enter:
- **MooZ relay URL**: `https://mooz-relay.onrender.com`
- **MooZ RELAY_ADMIN_KEY**: your existing Render secret, entered only in ToonFlow's server-side provider settings
- **Chrome device ID**: `chrome-main` (match the Extension)

In an image-generation node select `Muse / Chrome` and send a short prompt. If a job fails, inspect Muse before retrying; the relay never resubmits uncertain jobs.

## Limitations

This is an experimental text-to-image integration, not an official Muse API. No login, CAPTCHA, quota or access restrictions are bypassed. Image-generation output and prompts passing over `/toonflow` are **not end-to-end encrypted** (unlike MooZ `/remote`); Render temporarily processes the messages in memory. The relay has no persistent storage and a redeploy drops jobs and pairing sessions. A signed-in browser and calibrated selectors are required. Local/VM/browser end-to-end tests are still necessary.

The obsolete dedicated ToonFlow relay code has been removed from `quetvideo` to avoid deploying or configuring the wrong service.
