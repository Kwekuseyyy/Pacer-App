# Big Book Pacer — patch 4: no more page-scroll to reach answer choices

1 file changed: styles.css (only)

Desktop: .player is now capped to the viewport height (was min-height,
allowing it to grow past the screen). Passage/graph panes and the question
pane each scroll independently within their own box if their content is
tall — but the answer choices always stay visible, no whole-page scroll
needed to reach them.

Mobile (<=900px): reverted to normal page scrolling instead of forcing two
panes into fractional heights, which would be worse on a small screen.

Just drop this styles.css in and push — no JS changed this time.
