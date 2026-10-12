# Designer-made frames

To add a high-quality frame (a Polaroid, a film strip, a scrapbook page...):

1. Export the artwork from Figma / Illustrator / Photoshop as a **PNG with a transparent background**
   (or SVG). Leave the photo area **transparent** (a hole) so the picture shows through.
   If something should sit on top of the picture (tape, a camera body, a bow) export it as a second image.
2. Put the file(s) in this folder, e.g. `public/frames/polaroid-classic.png` (and `polaroid-classic-top.png`).
3. In `src/lib/collages.tsx` add an entry to `COLLAGES` (and the `CollageKind` list):

```ts
polaroidClassic: {
  label: 'Classic polaroid', group: 'frames',
  w: 100, h: 118,                       // the artwork's proportions (any numbers with the same ratio)
  underImg: '/frames/polaroid-classic.png',     // drawn behind the picture (optional)
  overImg: '/frames/polaroid-classic-top.png',  // drawn over the picture (optional)
  slots: [{ x: 8, y: 8, w: 84, h: 84, shape: 'bare', caption: true }],   // where the photo goes, in the same units
},
```

4. That's it: it appears in Stickers > Frames, with the plus button, the Edit sheet and the caption line.

Page templates are in `src/lib/templates.ts`: a list of pieces (paper, frames, stickers, text) with their position and size.
