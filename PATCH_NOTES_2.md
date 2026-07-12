# Big Book Pacer — patch 2: player layout fix + full-bleed hero

3 files changed. Overwrite the matching paths in your repo:

    js/view_player.js
    js/view_landing.js
    styles.css

## 1. Player layout — no more scrolling to see the choices

Before: RC passages got a proper left/right split, but graph, DI, and
directions crops stacked ABOVE the question in the same pane — meaning a
tall table (like your wind-speed example) pushed the choices below the
fold. On a 60-second clock, that's real lost time.

Now: every context type (passage, graph, setup, directions) goes into the
left pane, question + choices always stay in the right pane. The left pane
already had `max-height:78vh; overflow:auto; position:sticky` in the CSS —
so a tall table scrolls independently on the left while the question and
answer choices stay fully visible and stationary on the right.

## 2. Hero — full-bleed illustration instead of a boxed graphic

Before: the illustration sat in a ~40%-width box next to the text.
Now: it's the full section background (`.hero-bg`, `preserveAspectRatio=
"xMidYMid slice"` so it fills edge-to-edge with no letterboxing), with a
left-to-right dark scrim (`.hero-scrim`) so the headline stays readable
over the gears/grid detail, and headline/stat text switched to light
colors to read against the dark background. Mobile breakpoint updated to
a top-to-bottom scrim instead of a side gradient.

## Not fixed yet — need your input

**Missing axis on some DI graph crops**: this is a real image problem, not
a display bug — I haven't been able to confirm root cause without knowing
which specific crops. Two possibilities:
  (a) the crop itself is missing the axis (cut too tight when it was
      originally cropped from the scanned page) — fixable only by
      re-cropping from the original scan, which needs the source PDF/scan,
      not something I can do from the crop alone
  (b) something in rendering is clipping part of the image — fixable in
      code if that's the cause
Send me the specific test/section/question numbers (e.g. "t04 Q2 q16") and
I'll pull the actual crop file and tell you which one it is.
