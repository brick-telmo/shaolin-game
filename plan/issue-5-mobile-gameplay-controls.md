# Plan: Improve mobile gameplay controls

Related issue: [#5 - Improve the mobile gameplay controls](https://github.com/brick-telmo/shaolin-game/issues/5)

## Problem

On phones, the current touch buttons are small and sit below the play area. The requested experience is larger strike controls over the play area and finger-drag movement on its left side.

## Investigation

- The touch buttons are currently outside the arena in [`index.html`](../index.html#L22).
- At the phone breakpoint, the buttons are only 40px high and 35px minimum width in [`style.css`](../style.css#L4).
- Touch buttons currently set keyboard-style keys through pointer events in [`app.js`](../app.js#L165). `controls(0)` maps those keys to the game's existing input actions in [`app.js`](../app.js#L13).
- The game supports horizontal movement, jump, and guard; it does not have free vertical movement.

## Proposed solution

- On phones, move the touch UI into an overlay within the arena.
- Replace the small directional buttons with a transparent drag zone on the left. Track the active pointer relative to where the touch began, and show a subtle directional indicator while dragging.
- Map drag directions to existing actions: left/right move, up jumps, and down guards. This avoids changing game physics. If true vertical movement is intended, that is a separate design and gameplay change.
- Put larger Strike, Kick, and Special buttons on the right side of the play area, where they can be tapped while the movement finger remains down.
- Keep keyboard controls unchanged for desktop and local multiplayer.
- Maintain independent keyboard and touch input state, merging them when producing game input. Releasing one pointer must not cancel another active touch or held keyboard input.
- Handle pointer capture and release, including `pointercancel`, lost capture, mode changes, focus loss, and leaving an online match, so input cannot remain stuck.

## Implementation steps

1. Replace or reorganize the touch-controls markup to place the movement zone and attack buttons inside the arena.
2. Add phone-breakpoint styles for an unobtrusive overlay, clear labels, safe spacing, and comfortably large touch targets (target at least 56px square).
3. Implement drag-zone pointer handling with a dead zone, directional feedback, multi-touch support, and reliable input cleanup.
4. Route touch actions through the existing input mapping for CPU, story, local, and online modes.
5. Verify the layout and controls at narrow phone widths and in both portrait and landscape orientations.

## Validation

- Test that left and right drags move, up triggers jump, and down triggers guard.
- Test that Strike, Kick, and Special are independently tappable and can be used while a movement touch is held.
- Test pointer release, cancellation, focus loss, mode changes, and leaving online play for stuck inputs.
- Check that desktop keyboard behavior is unchanged and that online input continues to work.
- Run the existing test suite and build; perform a browser/device touch check at phone sizes.

## Acceptance criteria

- Mobile attack controls are visibly larger, at least 56px square, and overlay the play area.
- A finger drag on the left side controls the existing left/right, jump, and guard actions without directional buttons.
- Movement and attack can be used simultaneously with separate fingers.
- Controls work in supported game modes without changing keyboard behavior or game mechanics.
- Releasing or cancelling a touch always clears its input.

## Risks and non-goals

- The drag zone and attack buttons cover part of the arena; placement and transparency should keep both fighters and the HUD readable.
- This plan maps vertical drags to the existing jump/guard actions. Adding up/down character movement is out of scope unless explicitly requested.
