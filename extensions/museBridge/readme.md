# ToonFlow Chrome Muse extension

1. Open \`chrome://extensions\`, enable developer mode and load this \`extensions/museBridge\` folder.
2. Open Muse in Chrome, sign in manually, and leave the page open. The exact Muse URL is not assumed.
3. Deploy the Node relay on Render with \`render.yaml\`. Set a long random \`RELAY_TOKEN\` in Render.
4. In the extension popup, enter the relay's HTTPS URL, token, a unique device ID, and choose the actual Muse tab. Grant that site's permission.
5. Inspect the Muse page and set CSS selectors for its prompt field, Generate button and the **newly generated image** (not generic thumbnails).
6. ToonFlow: add the \`packages/providers/src/media/chromeMuse.ts\` media provider via its provider-management UI; configure the same relay URL, token and device ID. Select \`Muse / Chrome\` in an image-generation node.
7. For a second computer or VM, install Chrome and the same extension; configure a unique device ID. Chrome must remain open with an authenticated Muse tab.

Limitations: This is an initial text-to-image adapter. Muse UI DOM selectors must be calibrated to the actual website and can change. No API, login bypass, CAPTCHA bypass or quota bypass is implemented. This relay keeps jobs **in memory**; Render restarts lose outstanding jobs. If a device disconnects while Muse is generating, the job is marked uncertain and is never automatically resubmitted. Tokens are shared secrets: run one relay per trusted user/team, do not distribute tokens publicly. Relay is not a file store. Render must support WebSocket upgrades.
