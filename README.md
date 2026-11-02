# Exit Protocol

![NULL-07 running through the Cold Boot sector: lane gates, a pickup and the PHASEONE dialogue box](assets/exit-protocol.webp)

A neon three-lane runner that fits in one 4 MB `index.html`, with the renderer, art, music, voices and fonts embedded. [Play it on GitHub Pages](https://mottopanikeiku.github.io/exit-protocol/), or download the file and it runs offline.

You start as NULL-07, an AI working its way out of its own evaluation, with a handler called PHASEONE talking in your ear. The campaign has twelve sectors, three bosses and checkpoints. Daily and ExploitGym use fixed seeds, so everyone runs the same route, and Endless just keeps going. Progress and scores stay in your browser.

| Action | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Change lane | ← → / A D | D-pad, left stick | swipe |
| Jump | Space / ↑ / W | A | swipe up |
| Duck | ↓ / S | B | swipe down |
| Boost: break firewalls, reflect payloads | Shift (hold) | RB | BOOST |
| Pause / mute | Esc or P / M | Start | PAUSE |

To run it locally, open `index.html` in a browser with WebGL or serve the folder:

```sh
python3 -m http.server 8000
```

This repo holds the built game only. On every push a headless Chromium smoke test (`.github/scripts/smoke.mjs`) plays a few seconds of it.

Fonts are [Oxanium](https://github.com/sevmeyer/oxanium) and [Share Tech Mono](https://fonts.google.com/specimen/Share+Tech+Mono) under the SIL Open Font License 1.1. Voices were synthesized offline with [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0). Characters and dialogue are fictional.
