# Aditi's World

A portfolio that reads top to bottom like a page. She steps out of her cottage, you walk her through a small hedge maze
(scroll, click the path, or use the arrow keys), she sits on a bench, and the portfolio options are laid out below her.

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # maze and world walkability tests
npm run build   # production build in dist/
```

## Make it yours

All portfolio text lives in `src/content/portfolio.ts`, including the name of each place in `sections`. Swap in your own
work, links and images, and set `resume.file` to a PDF in `public/` to show a download link.

## Where things are

- `src/game/world/maze.ts` is the maze, drawn by hand as text: `#` is hedge and `.` is path. Edit it to change the route;
  `npm test` checks it is still small, solvable and easy.
- `src/game/world/generate.ts` lays out the page, top to bottom.
- `src/game/scene/Director.tsx` runs the story and the fixed overhead view.
- `archive/3d-game-version/` holds the earlier full 3D game, in case you want anything from it. Delete it freely.
