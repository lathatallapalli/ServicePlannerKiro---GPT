# Known Issues

Tracked limitations and deferred improvements. Each entry notes the current behavior, the desired behavior, and where it lives in the code.

## Focus does not align the time window

**Area:** Full planner — "View only this order on planner" (focus toggle).

**Current behavior:** Focusing an order scrolls to (and pulses) its bookings within the currently loaded time window, mirroring "Find order on planner". It does not move the view window (`viewStart` / `viewEnd`).

**Limitation:** If the focused order's bookings fall on a different day/week than what is currently displayed, scrolling alone cannot reveal them — the window stays put, so the order can appear to have nothing to scroll to.

**Desired behavior (deferred):** On focus, also align the time window to the order's booking dates (as `goToAutoBookingRangeNoticeTarget` / `alignViewWindowToOrder` do) so focus always lands on the bookings, even across dates. Deferred because it is a larger behavior change than the scroll-only fix and needs its own validation.

**Code:** `viewOnlyOrderOnPlanner` in `src/app/features/service-planner/service-planner.component.ts` (scroll-only + pulse on focus-on). Window-alignment helpers: `alignViewWindowToOrder`, `setViewWindowForMode`.
