# Player coverage calibration

Research checked 2026-09-08. This is a configurable rehearsal heuristic, not a
population norm or a measurement of the viewer.

- Armstrong et al. (2025), [Lateral End-Range Movement Profile and Shot
  Effectiveness During Grand Slam Tennis Match-Play](https://pmc.ncbi.nlm.nih.gov/articles/PMC11730432/),
  report male professional peak lateral speeds of 5.48–5.92 m/s by ranking group,
  with higher demands associated with lower shot quality. These elite observations
  do not establish a recreational player's guaranteed reach.
- Filipcic et al. (2017), [Split-Step Timing of Professional and Junior Tennis
  Players](https://pmc.ncbi.nlm.nih.gov/articles/PMC5304278/), report substantial
  situation and group variation in response timing, around 0.28–0.35 seconds in
  the reported group/situation means. This motivates a response delay rather
  than movement starting instantaneously at the opponent's contact.

The authored baseline is 1.75 m adult stature, 0.28 s response delay, 5.5 m/s²
acceleration, 4.5 m/s maximum speed, 1.05 m horizontal racket reach, and a
0.25–2.65 m contact-height window. Stature, acceleration, reach and height limits
are product assumptions, not values claimed as measured by these studies.
The display allowance multiplies horizontal movement and racket reach by 1.12.
The opponent retains its separately authored 4.8 m/s and 6.5 m/s² travel bounds.

Coverage is time dependent: accelerated distance after the response delay, then
constant-speed distance, plus racket reach. Camera lateral position and distance
behind the baseline locate the viewer on court; changing field of view or camera
height does not make the assumed adult taller. Candidate interception points must
clear the net, lie on the viewer's side, fit the contact height, precede the
second bounce, and have a legal first bounce if taken after the bounce. A serve
must bounce before the receiver can hit it. Modest court runoff remains available.

Quick Practice stores the result without changing the incoming shot. Drills also
solve whether a return can reach the next opponent contact at a feasible time.
That second test can fail even when the incoming ball is reachable. Failed links,
rest boundaries and new serves begin a new feed; no successful rally is fabricated.

Coach calibration and owner review remain open. The initial model does not infer
the viewer's height, fitness, handedness, anticipation or real physical movement.
