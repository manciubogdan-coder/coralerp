# Producție lib rules
- Line speed reports (`src/lib/productie/lineSpeed.ts`) divide pieces by worked session time with overlapping same-line sessions merged, compare to the line's configured hourly norm, and keep open sessions out; suspect sessions are listed and excluded only by an explicit toggle. Why: speed must reflect real working time, not calendar hours or double-counted grouped orders.
