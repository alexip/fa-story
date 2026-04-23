# Fa Story

A small podcast site starring **Fafa**, a brown tabby with white paws and green
eyes. The page is almost entirely a live canvas: Fafa wanders a warm, dust-lit
panel and comes over to investigate your cursor. The media player is a small
card that plays the latest episode.

## Run it

Static HTML, no build step. Any static file server works:

```sh
python3 -m http.server 4178
# then open http://localhost:4178
```

## Files

- `index.html` — layout and markup
- `styles.css` — palette (warm browns, cream, leaf-green) and responsive grid
- `cat.js` — canvas animation; Fafa's drawing, motion, pupil tracking, blinking
- `player.js` — audio element, play/pause, seek, time readout

## Replacing the episode

`player.js` sets `EPISODE_SRC` to a placeholder MP3. Swap it for the real
episode URL (or wire it up to your podcast feed).
