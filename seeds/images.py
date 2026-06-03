#!/usr/bin/env python3
"""
image_downloader.py
-------------------
Reads  clean-updated.json  (same folder as this script),
downloads every product image from the remote URL,
saves it directly in  <project_root>/uploads/
and writes   clean-updated-local.json  where every image URL
is replaced with the local public path  /uploads/...

Usage
-----
  python image_downloader.py
  python image_downloader.py --json ./clean-updated.json --output ./uploads

Environment
-----------
  MAX_WORKERS      number of parallel download threads  (default: 8)
  REQUEST_TIMEOUT  seconds per request                  (default: 30)
"""

import argparse
import hashlib
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urlparse

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


# ── Config ────────────────────────────────────────────────────────────────────
SCRIPT_DIR   = Path(__file__).resolve().parent
DEFAULT_JSON = SCRIPT_DIR / "clean-updated.json"
# The uploads folder is at the project ROOT (two levels up from src/seeds)
DEFAULT_OUT  = SCRIPT_DIR.parent.parent / "uploads"
MAX_WORKERS  = int(os.environ.get("MAX_WORKERS", 8))
TIMEOUT      = int(os.environ.get("REQUEST_TIMEOUT", 30))
PUBLIC_BASE  = "/uploads"     # URL prefix served by Express


# ── HTTP session with retry ───────────────────────────────────────────────────
def make_session() -> requests.Session:
    session = requests.Session()
    retry   = Retry(total=3, backoff_factor=1,
                    status_forcelist=[429, 500, 502, 503, 504])
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    session.mount("http://",  adapter)
    session.headers.update({"User-Agent": "Mozilla/5.0 (compatible; SolutionsEventsSeeder/1.0)"})
    return session


SESSION = make_session()


# ── Helpers ───────────────────────────────────────────────────────────────────
def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[àáâãäå]", "a", text)
    text = re.sub(r"[èéêë]",   "e", text)
    text = re.sub(r"[ìíîï]",   "i", text)
    text = re.sub(r"[òóôõö]",  "o", text)
    text = re.sub(r"[ùúûü]",   "u", text)
    text = re.sub(r"[ç]",      "c", text)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")[:80]


def url_to_filename(url: str) -> str:
    """Derive a clean filename from a URL, preserving extension."""
    parsed = urlparse(url)
    name   = Path(parsed.path).name          # e.g. "product-image.JPG"
    stem, ext = os.path.splitext(name)
    # Normalise extension to lower-case; default to .jpg
    ext = ext.lower() if ext else ".jpg"
    if ext not in {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}:
        ext = ".jpg"
    # Use an MD5 of the full URL as a stable, unique stem
    h = hashlib.md5(url.encode()).hexdigest()[:10]
    clean_stem = re.sub(r"[^a-z0-9_-]", "-", stem.lower())[:40]
    return f"{clean_stem}-{h}{ext}"


def download_image(url: str, dest_dir: Path) -> str | None:
    """
    Download *url* directly into *dest_dir* (no per-product subfolder).
    Returns the public path  /uploads/<filename>  on success,
    or None on failure.
    """
    filename = url_to_filename(url)
    dest     = dest_dir / filename

    if dest.exists():
        return f"{PUBLIC_BASE}/{filename}"

    try:
        resp = SESSION.get(url, timeout=TIMEOUT, stream=True)
        resp.raise_for_status()
        dest.parent.mkdir(parents=True, exist_ok=True)
        with open(dest, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
        return f"{PUBLIC_BASE}/{filename}"
    except Exception as exc:
        print(f"  ✗  FAILED  {url}\n      → {exc}", file=sys.stderr)
        return None


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Download product images")
    parser.add_argument("--json",   default=str(DEFAULT_JSON), help="Path to clean-updated.json")
    parser.add_argument("--output", default=str(DEFAULT_OUT),  help="Folder to save images into (default: <root>/uploads)")
    args = parser.parse_args()

    json_path  = Path(args.json)
    output_dir = Path(args.output)

    if not json_path.exists():
        sys.exit(f"ERROR: JSON file not found: {json_path}")

    with open(json_path, encoding="utf-8") as f:
        products = json.load(f)

    print(f"Loaded {len(products)} products from {json_path}")
    output_dir.mkdir(parents=True, exist_ok=True)
    print(f"Saving images to: {output_dir}")

    # Build a flat work list: (product_index, image_index, url)
    tasks: list[tuple[int, int, str]] = []
    for p_idx, product in enumerate(products):
        for i_idx, url in enumerate(product.get("images", [])):
            if url and url.startswith("http"):
                tasks.append((p_idx, i_idx, url))

    print(f"Images to download: {len(tasks)}")

    # --- Parallel download ---------------------------------------------------
    result_map: dict[tuple[int, int], str] = {}
    done = 0
    t0   = time.time()

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        future_to_key = {
            pool.submit(download_image, url, output_dir): (p_idx, i_idx, url)
            for p_idx, i_idx, url in tasks
        }
        for future in as_completed(future_to_key):
            p_idx, i_idx, url = future_to_key[future]
            local_path = future.result()
            result_map[(p_idx, i_idx)] = local_path if local_path else url
            done += 1
            if done % 50 == 0 or done == len(tasks):
                elapsed = time.time() - t0
                print(f"  {done}/{len(tasks)}  ({elapsed:.1f}s)")

    # --- Patch products with local paths -------------------------------------
    updated_products = []
    for p_idx, product in enumerate(products):
        p = dict(product)
        new_images = []
        for i_idx, url in enumerate(product.get("images", [])):
            if url and url.startswith("http"):
                new_images.append(result_map.get((p_idx, i_idx), url))
            else:
                new_images.append(url)    # keep non-http as-is (e.g. youtube embed)
        p["images"] = new_images
        updated_products.append(p)

    # --- Write output JSON ---------------------------------------------------
    out_json = json_path.parent / "clean-updated-local.json"
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(updated_products, f, ensure_ascii=False, indent=2)

    success = sum(1 for v in result_map.values() if v.startswith(PUBLIC_BASE))
    failed  = len(tasks) - success

    print(f"\n✓  Done in {time.time()-t0:.1f}s")
    print(f"   Downloaded : {success}")
    print(f"   Failed     : {failed}")
    print(f"   Output JSON: {out_json}")


if __name__ == "__main__":
    main()