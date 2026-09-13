# SDD ledger — plan: C:/Users/jiang/Documents/toki-pona/.worktrees/world-scale-prototype/docs/superpowers/plans/2026-08-29-forest-waterwheel-visual-benchmark.md

## Preflight consistency scan

| Scope | Shared boundary / invariant | Ruling before implementation |
| --- | --- | --- |
| Task 1 self | Selected private concept files, hashes, runtime prohibition | Preserve the six selected files exactly, verify all four recorded hashes, commit only in the private asset repository, and do not push. |
| Task 2 self | Public forest visual asset contract | Extend the existing fail-closed asset authority without weakening the current glyph-only boundary; unapproved, missing, or hash-mismatched forest packs remain unavailable. |
| Task 3 self | Runtime art production and approval | Generate candidate art only in the private repository. Stop at the mandatory user visual/legal audit before marking it approved or exporting it to the public repository. |
| Task 4 self | Responsive viewport | Replace the portrait profile switcher with a fixed 360-logical-pixel-height viewport whose width follows the available aspect ratio; preserve nearest-neighbor rendering and existing game logic. |
| Task 5 self | Audit-only movement | The benchmark controller may move/collide in the verified waterwheel geometry but must not write GameSession task events or replace production progression logic. |
| Task 6 self | Time and lighting | Project the approved 48-minute cycle and remove unconditional player glow; visual time must remain deterministic and gameplay-independent in this benchmark. |
| Task 7 self | Approved asset consumption | Load only the verified public runtime pack; fail closed to explicit diagnostics, not silent placeholders, when approval/hash/shape checks fail. |
| Task 8 self | Canvas/UI composition | Compose viewport, environment, character, and narrow audit UI without restoring the laboratory-style button wall. |
| Task 9 self | Acceptance | Run browser, assets, tests, typecheck, build, and visual checks; do not claim the benchmark accepted until the user reviews it. |
| Tasks 1 → 3 | Private concept authority | Task 3 must consume the exact committed Task 1 references and keep concept-only files non-runtime. |
| Tasks 2 → 3 | Export manifest/schema | Task 3 export must satisfy Task 2's public contract exactly; no ad-hoc file copies or bypass flags. |
| Tasks 2 → 7 | Runtime loader authority | Task 7 must load via the strict Task 2 reader/gate, not import private or candidate assets. |
| Tasks 2 → 9 | Release verification | Task 9 includes the strict asset gate and must fail if the public runtime pack is missing, stale, unapproved, or hash-mismatched. |
| Tasks 3 → 7 | Approved waterwheel pack | Task 7 cannot start production asset integration until the Task 3 user audit is explicitly approved. |
| Tasks 4 → 5 | Viewport/frame contract | Movement coordinates remain logical-world coordinates; resizing changes camera projection only. |
| Tasks 4 → 7 | Viewport and traveler frames | Character/environment projection uses logical dimensions from Task 4 and must not bake portrait assumptions into assets. |
| Tasks 4 → 8 | Full-screen composition | Task 8 consumes Task 4's responsive frame directly; CSS must not reintroduce a fixed 9:16 canvas. |
| Tasks 5 → 8 | Audit snapshot | Task 8 may display semantic audit state from Task 5 but may not expose debug mutation controls as gameplay UI. |
| Tasks 6 → 7 | Lighting-ready art | Task 7 keeps albedo/material separation compatible with Task 6 ambient and local-light projection. |
| Tasks 6 → 8 | Day/night presentation | Task 8 composes Task 6 lighting without player glow and with deterministic time controls limited to audit use. |
| Tasks 7 → 8 | Render inputs | Task 8 renders verified pack/environment/traveler frames through explicit typed inputs and preserves fail-closed diagnostics. |
| Tasks 8 → 9 | Browser acceptance | Task 9 verifies the actual composed page at desktop and responsive sizes, not isolated model tests only. |

## Preflight ruling

- The design asks for integer pixel scaling, while Task 4 also requires a full-screen fixed-height 360 logical-pixel view at arbitrary CSS sizes (the 960×540 example implies 1.5× CSS scale). Those requirements cannot both hold for every viewport. The binding ruling is: preserve a 360-pixel logical render target, nearest-neighbor sampling, integer logical coordinates, and full-screen coverage; allow fractional CSS scale only when the physical viewport cannot provide an integer multiple. Device-pixel-ratio-aware sizing should prefer integral device-pixel scaling where available. Cost: a minority of viewport/DPR combinations can show uneven pixel widths, but no gameplay coordinate or art asset is resampled internally.
- `object-fit: fill` is acceptable only because the logical width is derived from the live viewport aspect ratio; it must not stretch a fixed-aspect render target.
- Task 3's user audit is an intentional approval boundary, not an implementation ambiguity.

## Task status

| Task | Implementer | Review | Status | Evidence / notes |
| --- | --- | --- | --- | --- |
| 1 | visual_task1_private_refs | visual_task1_review | completed | Private commit `00ceb744472a8b89fe4fe799289e619974ce3a5a`; exact six-file scope and four hashes independently approved; no push. |
| 2 | visual_task2_asset_boundary | visual_task2_review | completed | Commits `7440c42`, `3a10492`, `6b9fb95`; 32 focused + 876 full tests green; three bypass classes fixed and cumulative review approved. |
| 3 | visual_task3_art_candidates | pending | v003 redesign | User rejected v002 environment art and approved a non-infringing systemic-material pixel-art redesign: 1 px material clusters, large dark space, clear physical materials, simpler original wheel/ruins; v001/v002 preserved privately. |
| 4 | pending | pending | pending | |
| 5 | pending | pending | pending | |
| 6 | pending | pending | pending | |
| 7 | pending | pending | pending | Blocked on Task 3 approval/export. |
| 8 | pending | pending | pending | |
| 9 | pending | pending | pending | Final user visual acceptance required. |
