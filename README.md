# 2048

A mobile-friendly, dependency-free web version of the 2048 puzzle game.

**Live site**: https://jeffreyp.github.io/twentyfortyeight/

## How to play

Slide tiles with arrow keys (or swipe on touch devices). When two tiles with
the same number touch, they merge into one. Reach the 2048 tile to win —
keep playing after that to chase a higher score.

## Development

No build step is required — it's plain HTML/CSS/JS in `public/`.

```bash
npm start   # serves public/ locally for preview
```

Then open the printed local URL in a browser.

## Deployment

Hosted on GitHub Pages, deployed from the `public/` folder via the `gh-pages`
package:

```bash
npm install
npm run deploy
```

`homepage` in `package.json` must match the GitHub Pages URL.
