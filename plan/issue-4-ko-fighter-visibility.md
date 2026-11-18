# Plan: Hide defeated fighters between rounds

Related issue: [#4 - Character pieces remain visible after a player loses](https://github.com/brick-telmo/shaolin-game/issues/4)

## Problem

At the end of every round, part of the losing fighter remains visible during the knockout intermission. The expected behavior is that no part of the defeated fighter remains on the play area until the next round starts.

## Investigation

The renderer draws every fighter on each frame. When a fighter's health reaches zero, it selects the `ko` pose, then continues drawing that sprite during the knockout phase. The KO pose is rotated within a fixed-size offscreen sprite canvas, which may clip the character and account for the visible fragment. See [`render.js`](../render.js#L32) and [`render.js`](../render.js#L74).

The match then either resets the round, restoring the fighters' health, or ends the match after a fighter runs out of lives. See [`core.js`](../core.js#L64).

## Proposed solution

1. Reproduce the issue at the end of a round and confirm it occurs during the knockout intermission.
2. In the renderer, skip the complete fighter draw pass while that fighter's health is zero. This must suppress the sprite, shadow, attack effects, and other fighter-specific marks so no fragment remains.
3. Keep the existing knockout announcement, health/lives HUD, match timer, life decrement, and winner logic unchanged.
4. Verify that the fighter becomes visible again when the next round reset restores their health. If the match ends instead, keep the eliminated fighter hidden on the results screen.

This addresses the reported behavior directly and avoids relying on the clipped KO sprite. If a visible fallen-fighter animation is desired later, treat correcting and testing the KO sprite's rotation and positioning as a separate visual change.

## Regression checks

- During a knockout intermission, the defeated fighter is not drawn, while the surviving fighter remains visible.
- After the next-round reset, both fighters are drawn again.
- On the final loss, the eliminated fighter remains hidden on the results screen.
- Verify the behavior in the shared rendering path for CPU, local, and online matches where practical.
- Run the existing game tests to ensure knockout, life, reset, and winner behavior is unchanged.

## Acceptance criteria

- No part or shadow of the losing fighter is visible during or after the round-ending knockout.
- The surviving fighter and match UI remain visible and correct.
- Both fighters appear at the start of the next round.
- Match outcomes and life counts are unchanged.
