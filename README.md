# Galaxian

A browser clone of Namco's **Galaxian** (1979), drawn on a single 224×256 canvas — the
arcade board's portrait resolution (224 wide, 256 tall). No build step, no
dependencies, no network calls: four plain scripts and one stylesheet.

## Run

```sh
cd galaxian-web
python3 -m http.server 8000   # then open http://localhost:8000/
```

Opening `index.html` directly also works — the scripts are classic (non-module)
files, so `file://` needs no server.

## Play on a phone

Live at <https://tedris.github.io/galaxian-web/> (GitHub Pages, `main`). Touch
devices get a controller under the screen: steer arrows on the left, FIRE on the right.

For an unpublished build, `python3 -m http.server 8000` binds all interfaces,
so a phone on the same Wi-Fi can open `http://<this-machine>:8000/`.

## Controls

| Key | Action |
| --- | --- |
| `←` `→` / `A` `D` | Move the Galaxip |
| `Space` / `Z` / `X` / `Ctrl` | Fire (must release and press again for the next shot) |
| `1` / `2` | One or two players |
| `Enter` | Start a one-player game |
| `P` | Pause |
| `M` | Mute |

On touch devices a controller appears under the screen: `◀` `▶` steer on the
left, `FIRE` on the right.

## The game, as modelled here

- **The armada is 46 aliens**: 2 flagships, 6 red, 8 purple, and 30 blue in three
  rows of ten. They march and flap in formation, and the formation is never
  static — a sway slides the whole grid sideways.
- **Attacks peel off the formation.** One diver at a time breaks rank, arcs down
  the screen, and either comes back to its slot or exits at the bottom and
  re-enters from the top. Once three or fewer aliens are left in formation — or
  once nothing but flagships and reds remain — the survivors swarm: they loop
  back around the top of the screen instead of returning home, so the last rows
  have to be shot down.
- **Flagships run the gauntlet in convoy.** A flagship drops out with up to two
  red escorts flying in her wake; the two reds parked directly above her only
  ever fly with her. Shoot a diving flagship and the whole armada holds its
  fire for a beat, exactly as the arcade does.
- **Only one of your shots may be in flight.** A miss costs you the wait, which
  is the whole tension of the game.
- **Aliens shoot only when they are close** — never from higher than 90 px above
  the Galaxip's row.
- **Round flags** sit in the lower right: one large flag per ten rounds, one
  small flag per round, capped at 48.
- **A flagship that survives her dive and flies off the bottom** is lost for the
  round, but she returns to the top of the formation in a later round — up to
  four flagships at once, which is how a sloppy game snowballs.

### Scoring

| Target | In formation | Diving |
| --- | --- | --- |
| Blue Galaxian | 30 | 60 |
| Purple Galaxian | 40 | 80 |
| Red Galaxian | 50 | 100 |
| Galaxian Flagship | 60 | 150 |
| Galaxian Flagship in convoy, nothing else shot first | — | 150 |
| Galaxian Flagship after one escort is shot | — | 200 |
| Galaxian Flagship after both escorts are shot | — | 800 |

3 lives, one bonus Galaxip at 4,000 points (the Namco board's default dip
switch), score rolls over at 999,990. Two-player games alternate turns on death;
the top three scores of this browser are kept in `localStorage` under
`galaxian-web.scores.v1` and shown on the attract screen.

## How it is built

| File | Role |
| --- | --- |
| `src/sprites.js` | Sprite maps as character grids, one shared bug silhouette recoloured per enemy type, the 5×7 font, the explosion frames. Canvas atlases are baked once at boot. |
| `src/audio.js` | Every sound synthesised with WebAudio oscillators and noise — no samples. |
| `src/game.js` | State machine (attract / ready / play / dying / over), formation, dive and convoy paths, collisions, HUD. |
| `src/main.js` | Integer canvas scaling, keyboard and touch input, fixed 1/60 s simulation step. |

The simulation always advances in 1/60 s increments regardless of the display
refresh, so physics does not change between a 60 Hz and a 144 Hz screen.

## Where it deliberately differs from the arcade

- The dive arcs are hand-tuned Bézier-ish curves rather than the original
  table-driven path generator; they read the same but are not bit-identical.
- Difficulty ramps continuously with the round (faster formation, more
  simultaneous divers, tighter attack gaps) instead of following the arcade's
  per-round ROM table.
- The starfield is a scrolling three-layer parallax; the arcade drew the same
  star layers over a black background but with different wrap behaviour.
- Hi-scores persist in the browser. The arcade kept them in RAM until power-off.
