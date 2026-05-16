#!/usr/bin/env python3
"""Validate and normalize pose boundaries for a spritesheet."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

REQUIRED_POSES = [
    "idle",
    "planning",
    "attacking",
    "hit-target",
    "got-hit",
    "low-fuel",
    "down",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Map and validate spritesheet pose boundaries."
    )
    parser.add_argument("--json", required=True, help="Path to spritesheet.json")
    parser.add_argument("--image", required=True, help="Path to spritesheet image")
    parser.add_argument(
        "--autocorrect",
        action="store_true",
        help="Clamp out-of-bounds rectangles to image bounds",
    )
    parser.add_argument(
        "--write-json",
        action="store_true",
        help="Write corrected values back to the input JSON file",
    )
    return parser.parse_args()


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def get_image_size(path: Path) -> Tuple[int, int]:
    # Use macOS sips to avoid external Python dependencies.
    result = subprocess.run(
        ["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(path)],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Could not read image size with sips: {result.stderr.strip()}")

    width = None
    height = None
    for line in result.stdout.splitlines():
        line = line.strip()
        if line.startswith("pixelWidth:"):
            width = int(line.split(":", 1)[1].strip())
        if line.startswith("pixelHeight:"):
            height = int(line.split(":", 1)[1].strip())

    if width is None or height is None:
        raise RuntimeError("Could not parse pixelWidth/pixelHeight from sips output.")
    return width, height


def to_int(value: Any, field_name: str, pose_name: str) -> int:
    if isinstance(value, bool):
        raise ValueError(f"{pose_name}.{field_name} must be an integer, got bool")
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    raise ValueError(f"{pose_name}.{field_name} must be an integer, got {type(value).__name__}")


def normalize_rect(
    pose_name: str,
    rect: Dict[str, Any],
    image_w: int,
    image_h: int,
    autocorrect: bool,
) -> Dict[str, Any]:
    x = to_int(rect.get("x"), "x", pose_name)
    y = to_int(rect.get("y"), "y", pose_name)
    w = to_int(rect.get("w"), "w", pose_name)
    h = to_int(rect.get("h"), "h", pose_name)

    status = "ok"
    corrections: List[str] = []

    if w <= 0 or h <= 0:
        raise ValueError(f"{pose_name} has non-positive size: w={w}, h={h}")

    x2 = x + w
    y2 = y + h
    in_bounds = x >= 0 and y >= 0 and x2 <= image_w and y2 <= image_h

    if not in_bounds:
        if not autocorrect:
            status = "invalid"
        else:
            old = (x, y, w, h)

            x = max(0, min(x, image_w - 1))
            y = max(0, min(y, image_h - 1))
            max_w = image_w - x
            max_h = image_h - y
            w = max(1, min(w, max_w))
            h = max(1, min(h, max_h))
            x2 = x + w
            y2 = y + h

            if (x, y, w, h) != old:
                status = "corrected"
                corrections.append(
                    f"clamped from x={old[0]}, y={old[1]}, w={old[2]}, h={old[3]}"
                )

    return {
        "x": x,
        "y": y,
        "w": w,
        "h": h,
        "x2": x2,
        "y2": y2,
        "status": status,
        "corrections": corrections,
    }


def main() -> int:
    args = parse_args()
    json_path = Path(args.json).resolve()
    image_path = Path(args.image).resolve()

    if not json_path.exists():
        print(json.dumps({"error": f"JSON file not found: {json_path}"}))
        return 1
    if not image_path.exists():
        print(json.dumps({"error": f"Image file not found: {image_path}"}))
        return 1

    try:
        data = load_json(json_path)
        image_w, image_h = get_image_size(image_path)
    except Exception as exc:  # pylint: disable=broad-except
        print(json.dumps({"error": str(exc)}))
        return 1

    poses = data.get("poses")
    if not isinstance(poses, dict):
        print(json.dumps({"error": "spritesheet.json must contain an object at key 'poses'"}))
        return 1

    mapped: Dict[str, Dict[str, Any]] = {}
    missing = [name for name in REQUIRED_POSES if name not in poses]
    extra = [name for name in poses.keys() if name not in REQUIRED_POSES]
    errors: List[str] = []

    for pose_name in REQUIRED_POSES:
        if pose_name not in poses:
            continue
        rect = poses[pose_name]
        if not isinstance(rect, dict):
            errors.append(f"{pose_name} must be an object with x/y/w/h")
            continue
        try:
            mapped[pose_name] = normalize_rect(
                pose_name=pose_name,
                rect=rect,
                image_w=image_w,
                image_h=image_h,
                autocorrect=args.autocorrect,
            )
        except Exception as exc:  # pylint: disable=broad-except
            errors.append(str(exc))

    declared_w = data.get("sheetWidth")
    declared_h = data.get("sheetHeight")
    size_matches = declared_w == image_w and declared_h == image_h

    output: Dict[str, Any] = {
        "jsonPath": str(json_path),
        "imagePath": str(image_path),
        "imageSize": {"width": image_w, "height": image_h},
        "declaredSheetSize": {"width": declared_w, "height": declared_h},
        "sheetSizeStatus": "ok" if size_matches else "mismatch",
        "missingPoses": missing,
        "extraPoses": extra,
        "errors": errors,
        "poses": mapped,
    }

    if args.autocorrect and not errors:
        corrected = dict(data)
        corrected_poses: Dict[str, Dict[str, int]] = {}
        for pose_name in REQUIRED_POSES:
            if pose_name in mapped:
                pose = mapped[pose_name]
                corrected_poses[pose_name] = {
                    "x": pose["x"],
                    "y": pose["y"],
                    "w": pose["w"],
                    "h": pose["h"],
                }
        corrected["poses"] = corrected_poses
        corrected["sheetWidth"] = image_w
        corrected["sheetHeight"] = image_h
        output["correctedJson"] = corrected

        if args.write_json:
            with json_path.open("w", encoding="utf-8") as f:
                json.dump(corrected, f, indent=2)
                f.write("\n")
            output["wroteJson"] = True

    print(json.dumps(output, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
