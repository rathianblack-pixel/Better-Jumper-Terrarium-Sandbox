# Jumper sex & easier Tank Setup

## Choosing a jumper

- Each new resident can be female or male. Collection flow: choose a species, choose sex, inspect the preview, then **Add to tank**. Cancel does not spawn anything.
- First Home and the additional-tank wizard also require a choice. Their species portraits update as you choose and show adult proportions.
- The collection chooser can switch between the current growth stage and an adult preview.
- Male proportions develop gradually through the existing six growth stages. Adult males have more prominent front legs, heads, jaws and palps, with a narrower, longer abdomen. Species retain their own basic build; ant mimics stay slender, and naturally long-legged species keep that identity.
- Adult male peacock fans and selected male ornaments are not shown on females/immature males. Adult male regal coloration is distinct.
- This is visual identity only: care, stats, progression and breeding mechanics have not been changed.

## Existing saves

Unassigned residents retain their previous appearance until you choose. On loading or importing an old save, a one-time chooser covers unassigned residents in every tank and the holding cup. **Choose later** leaves them unassigned; return via **Jumpers → Choose sex** or the individual's profile. Each confirmation is saved immediately. Confirmed choices persist through growth, moving, save/reload and export/import, and are not offered again.

Individual profile/list/tank portraits use the resident's sex and stage. New in-tank photos use the same renderer. Existing saved photos remain historical snapshots, not regenerated illustrations.

## Tank Setup

- **Tap the current tank name** to open Tank Setup directly.
- Or use **Build → Tank Setup** or **Jumpers → Tank Setup**.
- The default section is **Appearance · background only**, with clickable background thumbnails and live preview. Backgrounds are no longer in global Settings.
- **Apply setup** saves the selected background; **Cancel** changes nothing. Background changes leave animals, furnishings, ground and climate untouched, even during a molt. **Undo last setup** restores the previous background when no later incompatible edit has intervened.
- Habitat/biome, biome + recommended layout, and preset layout are separate modes. Furnishing replacement still requires an explicit acknowledgement, and layout/biome application remains blocked during molt/recovery.
- Details show enclosure, capacity and furnishings. **Enclosure & tank management…** opens the existing enclosure/duplicate/reset/delete controls and discards any unapplied preview. Destructive actions retain their confirmations.
- Tank names continue to follow residents; this update does not introduce a separate naming system.

## Play and rebuild

Extract the whole ZIP and host it over HTTP, as described in README.md. No installation or build is required to play. Root-level `jumper.html` and `source/terrarium/dist/terrarium/jumper.html` are the same current build.

To rebuild from the included editable source:

```sh
node source/terrarium/build.js
```

Serve `source/terrarium/dist/terrarium/` after rebuilding. The build script refreshes the service-worker cache version. If replacing an installation at the same address, let the updated service worker activate and reload; keep the same browser and origin to retain your local save. Export a save first for an extra backup. Photos remain in the original browser's device-local photo store.

## Validation

See `validation/SEX_AND_TANK_SETUP_TEST_REPORT.md` and `validation/sex-and-tank-setup/`. Older validation folders are historical unless explicitly listed in the current RELEASE_VALIDATION.json.
