#!/usr/bin/env python3
"""Extract and join Ascension skill/talent records with their card variants."""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


DEFAULT_CLIENT_DIR = Path(
    "/home/xzerow/Games/ascension-wow/drive_c/Program Files/Ascension Launcher/resources/ascension-live"
)
ADVANCEMENT_FILE = Path("Data/Content/CharacterAdvancementData.json")
CARD_FILE = Path("Data/Content/SkillCardData.json")
INCLUDED_TYPES = {"Ability", "Talent", "TalentAbility"}


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def classify(entry: dict[str, Any]) -> str:
    entry_type = entry["Type"]
    if entry_type == "Ability" and entry.get("RequiredLevel") == 1:
        return "starter_skill"
    if entry_type == "Ability":
        return "ability"
    return "talent"


def normalize_card(card: dict[str, Any]) -> dict[str, Any]:
    return {
        "entry": card["Entry"],
        "isLucky": bool(card.get("IsLucky", False)),
        "isGolden": bool(card.get("IsGolden", False)),
    }


def normalize_entry(
    entry: dict[str, Any], cards_by_spell: dict[int, list[dict[str, Any]]]
) -> dict[str, Any]:
    spells = [spell for spell in entry.get("Spells", []) if isinstance(spell, int)]
    cards_by_entry: dict[int, dict[str, Any]] = {}
    for spell in spells:
        for card in cards_by_spell.get(spell, []):
            cards_by_entry[card["entry"]] = card

    result: dict[str, Any] = {
        "id": entry["ID"],
        "name": entry.get("Name"),
        "category": classify(entry),
        "type": entry["Type"],
        "requiredLevel": entry.get("RequiredLevel"),
        "class": entry.get("Class"),
        "tab": entry.get("Tab"),
        "icon": entry.get("Icon"),
        "quality": entry.get("Quality"),
        "randomQuality": entry.get("Quality_Random"),
        "spells": spells,
        "cards": sorted(cards_by_entry.values(), key=lambda card: card["entry"]),
    }

    for optional_field in (
        "AECost",
        "AECost_Random",
        "Flags",
        "Masteries",
        "RequiredAEInvestment",
        "RequiredTEInvestment",
    ):
        if optional_field in entry:
            result[optional_field[0].lower() + optional_field[1:]] = entry[optional_field]

    return result


def extract(client_dir: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    advancement_path = client_dir / ADVANCEMENT_FILE
    card_path = client_dir / CARD_FILE
    advancements = load_json(advancement_path)
    raw_cards = load_json(card_path)

    cards_by_spell: dict[int, list[dict[str, Any]]] = defaultdict(list)
    card_entries: set[int] = set()
    for raw_card in raw_cards:
        card = normalize_card(raw_card)
        cards_by_spell[raw_card["Spell"]].append(card)
        card_entries.add(card["entry"])

    selected = [entry for entry in advancements if entry.get("Type") in INCLUDED_TYPES]
    all_records = [normalize_entry(entry, cards_by_spell) for entry in selected]
    records = [record for record in all_records if record["cards"]]
    records.sort(key=lambda record: (record["category"], record["name"] or "", record["id"]))

    referenced_spells = {
        spell for entry in selected for spell in entry.get("Spells", []) if isinstance(spell, int)
    }
    matched_spells = referenced_spells & cards_by_spell.keys()
    unmatched_entry_ids = [record["id"] for record in all_records if not record["cards"]]
    duplicate_names = [
        name
        for name, count in Counter(record["name"] for record in records).items()
        if name and count > 1
    ]

    validation = {
        "source": {
            "clientDirectory": str(client_dir),
            "advancementFile": str(ADVANCEMENT_FILE),
            "cardFile": str(CARD_FILE),
        },
        "counts": {
            "rawAdvancements": len(advancements),
            "includedAdvancements": len(all_records),
            "cardBackedRecords": len(records),
            "rawCardVariants": len(raw_cards),
            "uniqueCardEntries": len(card_entries),
            "referencedSpells": len(referenced_spells),
            "matchedSpells": len(matched_spells),
            "recordsWithoutCards": len(unmatched_entry_ids),
            "duplicateNames": len(duplicate_names),
            "byCategory": dict(Counter(record["category"] for record in records)),
        },
        "warnings": {
            "recordIdsWithoutCards": unmatched_entry_ids,
            "duplicateNames": sorted(duplicate_names),
        },
    }

    output = {
        "schemaVersion": 1,
        "source": validation["source"],
        "categories": {
            "starter_skill": "Ability entries requiring level 1",
            "ability": "Ability entries not requiring level 1",
            "talent": "Talent and TalentAbility entries",
        },
        "records": records,
    }
    return output, validation


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--client-dir",
        type=Path,
        default=DEFAULT_CLIENT_DIR,
        help="Ascension client directory",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("data"),
        help="Directory for generated files",
    )
    args = parser.parse_args()

    output, validation = extract(args.client_dir)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    with (args.output_dir / "cards.json").open("w", encoding="utf-8") as file:
        json.dump(output, file, ensure_ascii=False, indent=2)
        file.write("\n")
    with (args.output_dir / "validation.json").open("w", encoding="utf-8") as file:
        json.dump(validation, file, ensure_ascii=False, indent=2)
        file.write("\n")

    counts = validation["counts"]
    print(f"Extracted {counts['includedAdvancements']} records and {counts['rawCardVariants']} card variants.")
    print(f"Categories: {counts['byCategory']}")
    print(f"Records without cards: {counts['recordsWithoutCards']}")
    print(f"Wrote {args.output_dir / 'cards.json'}")
    print(f"Wrote {args.output_dir / 'validation.json'}")


if __name__ == "__main__":
    main()
