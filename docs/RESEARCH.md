# Sailing Research — Nautical Rules & Wind Physics

This document captures the research behind **Sail Trainer 3D**: how wind behaves,
how a yacht converts wind into forward motion, how turning maneuvers work, and the
rules of the road between sailing vessels. Every mechanic in the simulator maps back
to a section here.

---

## 1. True Wind vs. Apparent Wind

The single most important concept in sailing.

- **True wind (TW)** — the wind measured by a stationary observer (a buoy, an anchored boat).
- **Apparent wind (AW)** — the wind *you feel on a moving boat*. It is the vector sum of the
  true wind and the "headwind" created by the boat's own motion:

  ```
  AW = TW − V_boat        (vector subtraction)
  ```

- Consequences the player must discover:
  - The faster you sail, the more the apparent wind **shifts forward** (toward the bow)
    and usually **increases** when sailing upwind.
  - Sailing downwind, boat speed *subtracts* from the wind — a run feels eerily calm
    even in strong breeze, which is why runs feel slow and reaches feel fast.
  - **Sails are always trimmed to the apparent wind, not the true wind.**

Key angles used throughout:

| Term | Meaning |
|------|---------|
| TWA  | True Wind Angle — angle between boat heading and where the true wind comes *from* |
| AWA  | Apparent Wind Angle — same, but for apparent wind |
| TWS / AWS | True / Apparent wind speed |

## 2. Points of Sail

The compass of sailing. All angles are measured from the bow to the direction the wind
blows **from**:

| Point of sail | TWA (approx.) | Character |
|---|---|---|
| **In irons / No-Go Zone** | 0°–~30–45° | Sails cannot generate lift; boat stalls and stops |
| **Close-hauled** | ~35°–50° | Beating upwind, sails sheeted almost to centerline, max heel |
| **Close reach** | ~50°–80° | Fast and forgiving |
| **Beam reach** | ~90° | Wind abeam; typically the *fastest, easiest* point of sail |
| **Broad reach** | ~100°–150° | Wind over the quarter; sails well eased |
| **Run (dead downwind)** | ~150°–180° | Sails act as parachutes (drag, not lift); slow, risk of accidental gybe |

### The No-Go Zone

A boat **cannot sail directly into the wind**. Within roughly ±30–45° of the wind's
eye, the sail cannot maintain an angle of attack — it just flaps ("luffs") like a flag.
A boat caught head-to-wind loses speed and gets stuck **"in irons"**, drifting backwards
until it falls off onto one tack. To make progress upwind you must **beat**: sail
close-hauled on one tack, then the other, in a zigzag.

### Port tack vs. starboard tack

- **Starboard tack** — wind arriving over the starboard (right) side; boom carried to port.
- **Port tack** — wind over the port (left) side; boom carried to starboard.

## 3. How Sails Work — Aerodynamics

### Sails are wings, not bags (except downwind)

- Upwind and on reaches, a sail is an **airfoil**. Air flowing across the curved (cambered)
  sail generates **lift** roughly perpendicular to the sail chord, exactly like an
  aircraft wing turned vertical.
- Dead downwind, the sail works mostly by **drag** — a parachute. This is why running is
  *not* the fastest point of sail despite intuition.

### Angle of attack (AoA)

The angle between the apparent wind and the sail chord (boom):

- **AoA ≈ 0° → LUFFING.** The sail flaps, no force, boat decelerates.
- **AoA ≈ 15–25° → MAXIMUM LIFT.** Perfect trim. Smooth attached flow.
- **AoA too large → STALL.** Flow separates on the leeward side; lift drops, drag and
  heel increase. The boat feels pressed but slow.

### The universal trim rule

> **"When in doubt, let it out."** Ease the sheet until the sail's front edge (luff)
> just starts to bubble/flap, then sheet back in until it stops. That is perfect trim.

Practical boom-angle rules of thumb (mainsail):

| AWA | Boom position |
|---|---|
| ~30° (close-hauled) | On or near centerline |
| ~60° (close reach) | Out ~1/4 |
| ~90° (beam reach) | Out ~1/2 |
| ≥120° (broad reach/run) | Out as far as it goes (~80–90°) |

### Force decomposition — why boats heel

The total sail force points roughly perpendicular to the boom:

- **Drive** = component along the boat's heading → forward motion.
- **Side force** = component across the boat → **heeling** (leaning) and **leeway**
  (sideways drift).

Close-hauled, most of the force is sideways (much heel, modest drive); on a run, nearly
all of it is drive (no heel). The **keel** resists the side force: it converts sideways
push into forward "squeeze" (like pinching a watermelon seed) and limits leeway to a few
degrees. Excessive heel (>25–30°) actually *slows* the boat — the hull drags, the sail
spills, and the rudder loses grip. Real crews ease sheets or head up in gusts.

### Telltales

Small ribbons on the sail show flow state: streaming aft = attached flow (good trim);
fluttering = luffing or stalled. The simulator renders these.

## 4. Turning Maneuvers — The Heart of This Game

### Heading up / bearing away

- **Head up** = turn toward the wind → sheet **in** as you turn.
- **Bear away** = turn away from the wind → ease sheets **out** as you turn.
- Rule: *every course change requires a matching trim change.*

### Tacking (coming about) — turning the **bow through the wind**

Used to zigzag upwind. Steps:

1. Build speed close-hauled — **momentum is the fuel** that carries you through the no-go zone.
2. Helm over smoothly (not violently — a slammed rudder is a brake).
3. Bow crosses the wind's eye; sails luff and flog for a moment.
4. Keep turning until ~45° on the *new* tack; the sails fill on the other side.
5. Trim and accelerate.

**Failure mode:** turn too slowly, or start too slow, and you stall head-to-wind —
**in irons**. Recovery: wait while drifting backward, rudder reversed, until the bow
falls off; then sheet in and rebuild speed.

### Gybing (jibing) — turning the **stern through the wind**

Used to change tacks downwind. The boom sweeps violently from one side to the other
because the sail stays full of wind throughout the turn.

1. Sail deep on a broad reach / run.
2. Sheet the main **in toward centerline first** (controls the boom's swing).
3. Turn the stern through the wind.
4. The boom crosses — on a real boat, an uncontrolled gybe can injure crew and break rigs.
5. Ease the sheet out on the new side and settle onto the new course.

An **accidental gybe** happens when sailing dead downwind and letting the wind sneak
onto the same side as the boom ("sailing by the lee"). The simulator flags this danger zone.

### Tack vs. gybe — when to use which

- Upwind progress → **tack** (bow through wind).
- Downwind course change → **gybe** (stern through wind), or "chicken gybe" (tack all
  the way around) in heavy weather.

## 5. Rules of the Road (COLREGs) & Racing Basics

International Regulations for Preventing Collisions at Sea, **Rule 12 — Sailing Vessels**:

1. **Opposite tacks:** the vessel on **port tack keeps clear**; **starboard tack stands on**.
   ("Starboard!" is the classic hail.)
2. **Same tack:** the **windward** boat keeps clear of the **leeward** boat.
3. If a port-tack boat cannot tell what tack a windward boat is on, she keeps clear.
4. Windward side is defined as the side **opposite the boom** (opposite the mainsail).

Other relevant rules of the road:

- A sailing vessel under **engine** counts as a power vessel.
- Sail generally stands on over power, **except** vessels constrained by draft,
  restricted maneuverability, fishing vessels, or overtaking situations (the overtaking
  vessel *always* keeps clear — even under sail).
- Racing (RRS) mirrors Rule 12: port/starboard, windward/leeward, plus mark-room rules.

The simulator surfaces Rule 12 three ways: the instrument panel always names your
current tack; the tacking lesson teaches which tack stands on; and in Free Sail an
AI yacht sails a circuit while the HUD calls the live Rule 12 situation — whether
you are the stand-on or the give-way vessel, and what to do about it.

## 6. Wind Behavior Worth Simulating

- **Gusts and lulls:** wind speed fluctuates ±15–25% over seconds-to-minutes.
  In a gust the *apparent wind moves aft* → you can bear away or must ease; in a lull it
  moves forward → sheet in or head up.
- **Wind shifts:** direction oscillates. Upwind, tacking on "headers" (shifts that turn
  you away from destination) is the core of racing strategy — sail the "lifted" tack.
- **Wind gradient:** wind is stronger aloft than at sea level (surface friction) — the
  reason sails are twisted (eased more at the top).
- **No wind = no steerage:** rudders only work with water flowing past them; a stopped
  boat cannot turn.

## 7. Mapping Research → Simulator Model

| Reality | Simulator implementation |
|---|---|
| Apparent wind vector math | `AW = TW − V_boat` computed each frame; HUD shows both arrows |
| Sail as airfoil | Lift/drag coefficient curve over AoA: luff < 5°, peak ≈ 20°, stall beyond ≈ 35°, drag-mode toward 90° |
| Boom blows out to the sheet limit | boom angle = min(sheet setting, AWA); AoA = AWA − boom angle |
| Drive vs. heel split | drive = F·sin(boom), side = F·cos(boom); heel angle from side force, drive penalty at high heel |
| No-go zone | AoA collapses near head-to-wind; drag pushes boat backwards → "in irons" |
| Keel / leeway | Side force yields a few degrees of drift, resisted by lateral coefficient |
| Rudder needs flow | Turn rate scales with boat speed; near-zero speed = near-zero steering |
| Gusts/shifts | Smoothed noise on TWS and TWD (free-sail mode) |
| Momentum through tacks | Hull inertia; flogging sails produce no drive mid-tack |
| Accidental gybe | Sailing by the lee triggers warning, then a fast boom sweep |
| COLREGs Rule 12 | HUD reports current tack; lesson text teaches port/starboard & windward/leeward |

## Sources

- [Point of sail — Wikipedia](https://en.wikipedia.org/wiki/Point_of_sail)
- [Points of Sail Explained (with Degrees and Diagram) — Improve Sailing](https://improvesailing.com/sailing/trimming/points-of-sail)
- [What are the Points of Sail? — Offshore Sailing School](https://www.offshoresailing.com/sailing-basics-understanding-the-points-of-sail/)
- [Sheet for Shape, Traveler for Trim — Santana Sailing School](https://santanasailing.com/blog/2026/03/06/sheet-for-shape-traveler-for-trim/)
- [A Practical Sail Trim Guide for New Sailors — Naos Yachts](https://naosyachts.com/sail-trim-guide)
- [All About Downwind Sail Trim — North Sails](https://www.northsails.com/en-us/blogs/north-sails-blog/downwind-sail-trim-how-to-north-sails)
- [Know how: Sailing 101 — SAIL Magazine](https://sailmagazine.com/cruising/basic-sailing-101/)
- [COLREGs Rule 12 (Sailing vessels) — ecolregs.com](https://www.ecolregs.com/index.php?option=com_k2&view=item&layout=item&id=54&Itemid=387&lang=en)
- [Rule 12 — Sailing vessels — Cult of Sea](https://www.cultofsea.com/colregs/part-b-steering-and-sailing-rules-4-19/rule-12-sailing-vessels/)
- [Types of Sailing and Maneuvers — SailFleet](https://www.sailfleet.net/en/sailing-terminology)
