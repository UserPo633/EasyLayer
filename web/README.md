# EasyLayer demo studio

Browser-only demonstration for the EasyLayer Alexa+ experience simulation. No native Alexa connection, no live MCP server, and no real bookings are made by this hosted site. All displayed contacts and appointments are fictional. Local storage keeps only sample state.

## Architecture

`dist/engine.mjs` is the deterministic state machine. `dist/scene.mjs` renders a shared SVG visual used by the interactive demo and the automated video walkthrough. `dist/app.mjs` provides accessible HTML controls and a mobile summary. The source download is the earlier v0.4 backend project with its own documented validation boundaries.

Run `npm test` and `npm run build` to validate. Static output lives in `dist/`. Video construction is offline; it is not a browser capture or native Alexa recording. The 2:14 film includes English narration generated with ElevenLabs (Kayleigh, Eleven v4), burned English captions, and a WebVTT caption track. The MP3 is included in `dist/assets/narration-en.mp3`. Sentence timings in `scripts/narration-timing.json` follow measured pauses manually matched to the script. `scripts/render-narrated.py` retimes the existing storyboard PNGs, adds the audio, and exports the MP4. Run it after `scripts/render-video.mjs` if regenerating the visuals; the latter alone produces the silent base film.

The previous backend release recorded 117 tests; current browser simulation tests are separate and do not establish live Alexa or Easy!Appointments compatibility. No browser QA was performed in this managed environment because its required browser skill was unavailable.
