# Radial Interaction Checklist

This checklist audits the option-level radial control, not the surrounding app.
The goal is one helpful cue per decision moment, with heavier hints only when
the user is idle, approaching a target, or correcting a path.

## Hint Order

1. **Structure**: visible active bubble and sibling options show what can be chosen.
2. **Proximity**: nearby option reveals its next layer before commitment.
3. **Commit**: homed option brightens, pulls toward the cursor, and updates the projected count.
4. **Path Memory**: ink and breadcrumb show what has already been chosen.
5. **Correction**: backtrack erases or lifts the most recent segment; circle reset clears all.
6. **Confirmation**: leaf review and Apply appear only when there is a terminal path.
7. **Diagnostics**: the demo panel explains live radial state; it should not compete with the control.

## Interaction Cases

| Case | Trigger | Expected Result | Primary Hint | Polish Status |
| --- | --- | --- | --- | --- |
| Rest | No path selected | Root and level-one options are visible and calm | Root lens, faint option glass | Good |
| Idle approach | Cursor nears root or option | Rings wake subtly; nearby option gains presence | Inward root ring, option brightness | Good |
| Option preview | Cursor nears an option with children | Only that option's children bloom beside it | Smaller ghost children | Good |
| Preview exit | Cursor leaves option | Preview children retreat into parent | Fade and return-to-origin motion | Good |
| Direct click | Click a visible option | Option becomes active; path/count update | Synthesized ink stroke | Good |
| Drag start | Press near active/root | Active bubble appears as drag anchor | Cursor halo, live ink | Good |
| Homing | Drag toward a child | Target pulls/brights; siblings recede | Magnetic pull and accent rim | Good |
| Commit | Cross commit lane | Target becomes active; next options appear | Settle ripple, frozen ink | Good |
| Fast flick | High-velocity drag | Option fan fades but target remains readable | Reduced fan opacity | Good |
| Backtrack | Pull inward to previous anchor | Last segment exits; active returns to branch | Erase/Lift mode | Good |
| Sibling change | Backtrack then choose another sibling | Previous branch clears before new branch appears | Erase-to-branch motion | Good |
| Leaf | Commit to node without children | Review panel opens with Apply/Change | Panel action row | Good |
| Apply | Confirm terminal path | Applied toast appears; duplicate Apply hides | Toast and applied step | Good |
| Edit after apply | Backtrack, reset, or choose different path | Applied state clears; Apply returns | Path change and panel state | Good |
| Circle reset | Draw circle on empty paper | Whole path clears to root | Dotted command stroke + reset flash | Good |
| Slash layout | Draw diagonal slash on empty paper | Flow mode cycles | Command flash + toolbar state | Good |
| Empty-paper scribble | Ambiguous gesture | Nothing commits or changes | Temporary dotted stroke only | Good |
| Reset button | Click Reset | Path clears; options return to root | Toolbar reset | Good |
| Breadcrumb pop | Click path word | Path truncates to that level | Breadcrumb affordance | Good |
| Keyboard arrows | Arrow keys focus options | Focus ring moves among options | Accent focus ring | Good |
| Keyboard commit | Enter/Down on focused option | Focused option commits | Path/count update | Good |
| Escape | Escape key | Pops one level, then resets | Path truncation | Good |
| Reduced motion | OS reduce-motion enabled | Motion collapses to stable states | Static final positions | Good |

## Hint Budget

- At rest, show **structure + one quiet availability cue**. The demo disables the one-shot dotted first-run hint because the live radial-state panel already explains the mechanism.
- During approach, show **proximity preview** and avoid adding instructional copy.
- During commit, show **magnetism, ink, and count projection**; do not also flash command hints.
- During correction, show **erase/lift** and only one transient command label.
- During review, show **Apply/Change** inside the panel; do not duplicate Apply for the same already-applied path.

## Watch List

- Touch-device discoverability still needs a real pass with physical-device testing.
- The diagnostic panel is intentionally useful for the demo; production consumers should usually omit it.
- `right-flow` is the clearest test layout. Radial/orbit mode should get another spacing audit once the option set grows beyond four choices.
