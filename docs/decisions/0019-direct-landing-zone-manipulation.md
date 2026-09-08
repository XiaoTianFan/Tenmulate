# ADR-0019: Direct landing-zone manipulation

- Status: Accepted for local implementation
- Date: 2026-09-08
- Supersedes: The center and axis-arrow interaction in ADR-0018.

The entire rendered landing rectangle is the drag target. Remove the center
control and translation arrows. Hover increases the area's fill and boundary
contrast; the white ring continues to show the displayed ball's actual bounce.

A primary-button press inside the area captures a zone drag. Raycasting onto the
court plane translates X and Z together, including diagonals, while keeping the
original grab offset. The zone stays on the court surface. A press outside the
area captures camera look. That initial choice lasts through pointer release or
cancellation, even if the pointer crosses the boundary. Touch uses the same
area-based gesture without browser scrolling taking over the canvas.

Enter or Space selects the zone for keyboard movement. Arrow keys move it in
camera-relative ground directions; Escape deselects it. The shared scene control
applies to Quick Practice and drill-editor previews. Existing court/service-box
bounds, uniform sampling, dimensions and continuous preview scheduling retain
their ADR-0018 contracts.

Local verification is recorded in the
[direct-drag receipt](../development/landing-zone-direct-drag-2026-09-08.md).
