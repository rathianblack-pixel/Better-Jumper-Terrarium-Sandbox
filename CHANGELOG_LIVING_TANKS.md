# Living Tanks update

## Tank Setup live preview
- Added a direct **Tank Setup** button beside Switch Tank in Jumpers, plus a jumper-name shortcut menu and a Menu shortcut.
- Added biome-only, biome + recommended layout and preset-layout modes. Existing tank-settings biome/preset buttons now open this preview rather than immediately replacing decor.
- Preview uses a disposable clone, pauses live simulation and fits the enclosure into the unobstructed area beside/above a compact tray. Reroll never advances live time or allocates live entity IDs.
- Apply requires explicit confirmation before replacing furnishings. Cancel/Escape discard the clone. Existing individuals, prey, clocks, growth and care counters are retained; invalid supports and interrupted movement plans are safely reconciled.
- Added saved one-level setup Undo per tank, without rewinding animal progress. Later layout/ground/enclosure edits invalidate it. Generated presets reroll; saved custom presets keep their fixed positions.
- Apply and Undo are conservatively locked during molt seeking, molt retreat occupation, molting and post-molt recovery. Cancel resumes normal simulation.
- Preview controls retain the fixed-header/fixed-footer spacing and readable button styles from the preceding hotfixes.

## Sheet spacing hotfix
- Fixed collection cards sliding behind the persistent Jumpers action row.
- Kept Jumpers subtabs and wizard footer controls outside the scroller, with fixed breathing room.
- Padded collection cards and normalized text/control spacing across modal sheets.

## Contrast hotfix
- Fixed invisible **Continue** and **Create Tank & Enter** labels caused by a conflicting modal text-color rule.
- Kept Cancel/Back readable and added a visible keyboard-focus outline.
- Verified all three steps at desktop, phone portrait and phone landscape sizes. No gameplay or save-format changes.

## Tank creation and management
- Persistent **＋ Create New Tank** at the top left of Jumpers, above In this tank / Collection / Journal.
- **Tank type → unlocked species → recommended biome**, then **Create Tank & Enter**. A new individual is spawned; existing jumpers are not moved.
- Recommended furnished layout by default; empty/custom alternatives retained. Back preserves choices; changing species refreshes the biome recommendation. Cancel creates nothing.
- **30 tanks maximum**, visible counter, disabled creation button and explanation at capacity. Creation checks capacity again at commit time.
- **Switch Tank** provides search by tank/jumper/species/biome, Recent, Favorites, and Needs care. Molting is informational, not a hunger-care emergency.
- **Previous Tank**, remembered overview camera and selected jumper, and direct observation of jumpers housed elsewhere. Switching cancels unfinished placement, exits the outgoing observation/replay, saves, and resumes one destination only.

## Fully frozen inactive tanks
Each tank now owns its simulation clock and lighting mode. Only the active tank advances animals, prey, aging, hunger, hydration, molting, plants, droplets, weather and day/night. Return-time catch-up is removed. Saved biological conditions—not projected deterioration—drive care indicators. Inactive tanks have no simulation or rendering loop, but their data/geometry still consumes memory and adds to save size. Saving and opening the tank browser still involve the shelf; this is not a claim of zero total overhead.

## Jumper behavior
- Peripheral movement triggers orientation/inspection before prey recognition.
- Patient jump timing considers movement, alertness, personality and urgency, with a bounded wait so a hunt cannot stall forever.
- Hidden-target aiming and planning use last-seen locations; searches favor plausible cover and avoid rechecking the same vantage point. Old sightings expire. No target selection through blocked sight.
- Failed hunts remember the **launch point**, rather than the landing point, and penalize recently unsuccessful approaches. Two consecutive misses at one prey trigger a short cooldown, even when starving.
- Small, bounded visual and place memories persist in saves. Familiar perches, retreats and discovered water can influence route selection. Missing droplets and invalid supports invalidate memories.
- Hunger, hydration, risk and post-molt vulnerability are respected. Existing species-specific tactics and individual traits are retained rather than flattened into a universal super-predator.
- Directional substrate/silk vibration cues attract attention without revealing a hidden prey's identity or inserting a visual sighting. Cues are short-lived and range-limited; disconnected surfaces and airborne sources do not transmit them. This is a simplified gameplay model, not a scientific reconstruction.

## Molting and care
- Completing a molt reduces fullness to a hungry but bounded level.
- The jumper remains protected and does not hunt while its skin hardens. Recovery has reduced hunger expenditure.
- The compact jumper card now shows **Fullness**, **Hydration**, stage, molt progress, behavior and actionable concerns without needing expansion. Premolt fasting is explained separately from hunger that needs feeding.

## Prey
- Calm landed flies groom; crickets/locusts on foliage can sample it; other prey can rest quietly. These routines end when danger is detected.
- Procedural foreleg/antenna motion makes grooming and foliage sampling visible. Sampling is cosmetic, not a new plant-depletion system.
- Existing species-specific flight, hopping, burrowing and running escapes are retained. Repeated close encounters shorten a cricket's freeze; stalled escape routes have a timeout.
- Ground movement and landings produce bounded vibration cues. No new background prey work is scheduled.

## Saves and delivery
- Existing v4 saves and existing save/settings keys remain supported. Additive `simRevision`, local clocks, camera states and bounded memories are stored alongside the existing data.
- A one-time `jumperTerrarium.v14.save.before-living` backup is retained when an older save is first loaded. Use the existing Export control before replacing the release or changing host/browser/device.
- In-session switches preserve the full animal state. On a browser reload, the existing safe-restore behavior still discards transient movement plans and safely grounds midair animals; learned memories and biological state persist.
- Editable sources, build script and regression scripts are included. Do not deploy the source directory as the game entry point.

## AI improvement claim
The original-versus-upgraded forced-miss fixture measures **immediate retries before disengaging**, not animal intelligence. Original: three missed attempts / two immediate retries. Upgraded: two missed attempts / one immediate retry. That is **50% fewer immediate retries in this controlled failure scenario**. It does not prove a general “2× smarter” or “2× catch rate” claim. Natural hunts remain imperfect.
