# Ascension Build Generator

This project extracts Ascension skill and talent card data from a local game client.

## Web app

The web generator uses the verified Darkmoon normal-card pool and is configured
for GitHub Pages at `https://xzerow.github.io/asc-darkmoon-builder/`.

```bash
npm install
npm run dev
```

Run `npm run build` to create the production site in `dist/`. The GitHub Pages
workflow deploys the build whenever `main` is pushed.

The generator supports the current slot layout:

- Starter Skill Cards: 2 normal and 2 golden slots
- Ability Cards: 3 normal and 3 golden slots
- Talent Cards: 3 normal and 3 golden slots

Golden slots use the same skill pool as normal slots. They are displayed as a
slot property because their difference is acquisition rather than eligibility.

## Extract data

Run:

```bash
python3 scripts/extract_card_data.py
```

The default client directory is:

```text
/home/xzerow/Games/ascension-wow/drive_c/Program Files/Ascension Launcher/resources/ascension-live
```

Override it with `--client-dir` when needed. Output is written to `data/`:

- `cards.json`: normalized skill/talent records and their card variants
- `validation.json`: extraction counts and data quality warnings

Starter Skill Cards are currently classified as entries with `Type == Ability` and
`RequiredLevel == 1`. Ability Cards are all other abilities. Talent Cards include
both `Talent` and `TalentAbility` entries.

## Scan the in-game Skill Cards panel

The client data contains candidate cards, but the game UI can apply additional
realm or panel filters. The diagnostic addon in `addon/AscensionCardScanner`
captures the runtime UI state and relevant globals.

Copy it to the client:

```bash
cp -r addon/AscensionCardScanner \
  "/home/xzerow/Games/ascension-wow/drive_c/Program Files/Ascension Launcher/resources/ascension-live/Interface/AddOns/"
```

In-game:

1. Enable `Ascension Card Scanner` in the addon list.
2. Open the `N` panel and the `Skill Cards` tab.
3. Run `/ascexport`. It clears each Skill Cards tab's filter, then scans its normal-card list. Golden cards are not scanned because they have the same skill pool.
4. Run `/reload` after checking the chat output to save the data.

The scan is saved to:

```text
WTF/Account/<account>/SavedVariables/AscensionCardScanner.lua
```

This first version is diagnostic. It reveals the actual frame and API names so
the final exporter can read the complete card list instead of guessing from the
static client files.

## Convert the runtime pool

After `/ascexport` and `/reload`, convert the saved runtime export into the
generator dataset:

```bash
luajit scripts/export_runtime_pool.lua \
  "/home/xzerow/Games/ascension-wow/drive_c/Program Files/Ascension Launcher/resources/ascension-live/WTF/Account/XZEROW/SavedVariables/AscensionCardScanner.lua" \
  data/darkmoon-card-pool.json
```

`data/darkmoon-card-pool.json` is the authoritative Darkmoon normal-card pool.
It contains names, spell IDs, item IDs, card IDs, card quality, rank, icon, and
the `ability`, `starter_skill`, or `talent` category.
