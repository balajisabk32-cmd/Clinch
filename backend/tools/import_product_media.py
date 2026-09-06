"""Import the supplied product photography into the web catalogue.

The source folder holds 17 PNGs, several of them 8 MB. Shipping those into a
product grid would mean ~70 MB of images on one screen, so each is resized to a
sensible display width and re-encoded as JPEG. The originals are left untouched.

The filename is the only place the price and description exist, so the mapping
below is written out by hand rather than parsed: the names are inconsistent
enough ("rs 92000", "-₹69,990", "₹60  mo") that a regex would quietly mis-read
one and put a wrong price in the catalogue.

Run:  python backend/tools/import_product_media.py
"""

from __future__ import annotations

import pathlib
import sys

SRC = pathlib.Path(__file__).resolve().parents[2] / "oddo images"
OUT = pathlib.Path(__file__).resolve().parents[2] / "frontend" / "public" / "products"

# sku -> (source filename, display name, description, list price or None)
#
# A price of None means the supplied material does not state one. Those rows are
# reported and skipped rather than guessed: a made-up price would flow into
# quotations, risk scores and the leakage figure.
CATALOGUE: dict[str, tuple[str, str, str, float | None]] = {
    "LP14": (
        "Lenovo IdeaPad Slim 3 Intel Core i3 13th Gen 1315U - (8 GB512 GB SSDWindows 11 Home) IdeaPad Slim 3 15IRU8 Thin and Light Laptop (15.6 inch, Arctic Grey, 1.62 kg, With MS Office-₹69,990.png",
        "Lenovo IdeaPad Slim 3 15IRU8",
        "Intel Core i3 13th Gen 1315U, 8 GB RAM, 512 GB SSD, Windows 11 Home, 15.6 inch, 1.62 kg, with MS Office.",
        69990.0),
    "LP15-VIC": (
        "HP Victus(i5 14th Gen) Intel Core 5 210H - (24 GB512 GB SSDWindows 11 Home4 GB GraphicsNVIDIA GeForce RTX 3050) 15-fa2500tx  15-fa2497tx Gaming Laptop (15.6 inch, Mica Silver, Black rs 92000.png",
        "HP Victus 15-fa2500tx",
        "Intel Core 5 210H 14th Gen, 24 GB RAM, 512 GB SSD, NVIDIA GeForce RTX 3050 4 GB, Windows 11 Home, 15.6 inch.",
        92000.0),
    "SRV-RACK": (
        "Dell PowerEdge R740 Server  40 Core Server  64GB Ram  2.4 TB Storage  PID 20283-₹135,000.png",
        "Dell PowerEdge R740 Server",
        "40-core rack server, 64 GB RAM, 2.4 TB storage. Datacenter class, PID 20283.",
        135000.0),
    "DOCK-01": (
        "HP USB-C 100W G6 Dock-₹16,999.00.png",
        "HP USB-C 100W G6 Dock",
        "USB-C docking station with 100 W power delivery, multi-display and wired network output.",
        16999.0),
    "MON-27": (
        "Samsung LC27R500FHWXXL Curved Monitor 68.58 cm (27 Inch)-₹14,999.png",
        "Samsung LC27R500 Curved Monitor 27\"",
        "68.58 cm (27 inch) curved FHD monitor, 1800R curvature, flicker-free.",
        14999.0),
    "WAR-EXT": (
        "Extended Warranty  3-year full hardware coverage and advance replacement plan  ₹180 .png",
        "Extended Warranty",
        "Three-year full hardware coverage with advance replacement.",
        180.0),
    "SW-DESIGN": (
        "DesignSuite Licence  Professional UIUX and vector design suite licence  ₹900.png",
        "DesignSuite Licence",
        "Professional UI/UX and vector design suite licence.",
        900.0),
    "SW-SECURE": (
        "SecureEndpoint Licence  Enterprise endpoint protection, zero-trust security & antivirus.png",
        "SecureEndpoint Licence",
        "Enterprise endpoint protection with zero-trust security and antivirus.",
        420.0),
    "SW-BI": (
        "InsightBI Licence  Executive data visualization and predictive BI platform.png",
        "InsightBI Licence",
        "Executive data visualisation and predictive BI platform.",
        1600.0),
    "SVC-ONSITE": (
        "Onsite Setup Service  On-premise engineer deployment, hardware racking, and testing  ₹400 .png",
        "Onsite Setup Service",
        "On-premise engineer deployment, hardware racking and testing.",
        400.0),
    "SVC-INST": (
        "Install Service  Full datacenter installation, structured cabling, and network provisioning  ₹4,400.png",
        "Install Service",
        "Full datacenter installation, structured cabling and network provisioning.",
        4400.0),
    "SVC-TRAIN": (
        "Admin Training  1-on-1 technical administrator and staff training sessions  ₹750.png",
        "Admin Training",
        "One-to-one technical administrator and staff training sessions.",
        750.0),
    "SLA-GOLD": (
        "Support SLA Gold  247 priority enterprise support SLA (Yearly)  ₹5,400  yr .png",
        "Support SLA Gold",
        "24/7 priority enterprise support SLA, billed yearly.",
        5400.0),
    "CARE-2Y": (
        "Care Plan 2yr  2-year scheduled maintenance and preventive health checks (Monthly)  ₹240.png",
        "Care Plan 2yr",
        "Two-year scheduled maintenance and preventive health checks, billed monthly.",
        240.0),
    "SW-CLOUD": (
        "CloudSync Seat  Managed encrypted cloud sync and backup per-seat licence (Monthly)  ₹60  mo.png",
        "CloudSync Seat",
        "Managed encrypted cloud sync and backup, per-seat licence billed monthly.",
        60.0),
    # Supplied, but the material states no price anywhere -- not in the
    # filename and not in the image. Held back rather than guessed.
    "LP14-ASUS": (
        "ASUS Vivobook Flip Intel Core Ultra 7 256V - (16 GB512 GB SSDWindows 11 Home) TP3407SA-QL025WS 2 in 1 Laptop (14 Inch, Matte Gray, 1.57 Kg, With MSOffice).png",
        "ASUS Vivobook Flip TP3407SA",
        "Intel Core Ultra 7 256V, 16 GB RAM, 512 GB SSD, Windows 11 Home, 14 inch 2-in-1, 1.57 kg, with MS Office.",
        None),
    "LP15-THOM": (
        "Thomson NEO Core Series Intel Core i3 12th Gen 1215U - (8 GB512 GB SSDWindows 11 Home) IN-N15I Thin and Light Laptop (15.6 Inch, Grey Brush, 1.65 Kg).png",
        "Thomson NEO IN-N15I",
        "Intel Core i3 12th Gen 1215U, 8 GB RAM, 512 GB SSD, Windows 11 Home, 15.6 inch, 1.65 kg.",
        None),
}

MAX_W = 900          # plenty for a 3-up grid on a retina display
QUALITY = 82


def main() -> int:
    try:
        from PIL import Image
    except ImportError:
        print("Pillow is required: pip install pillow", file=sys.stderr)
        return 1

    if not SRC.exists():
        print(f"Source folder not found: {SRC}", file=sys.stderr)
        return 1
    OUT.mkdir(parents=True, exist_ok=True)

    saved_before = saved_after = 0
    missing: list[str] = []
    unpriced: list[str] = []

    for sku, (filename, name, _desc, price) in CATALOGUE.items():
        src = SRC / filename
        if not src.exists():
            missing.append(f"{sku}: {filename}")
            continue
        if price is None:
            unpriced.append(f"{sku} ({name})")

        im = Image.open(src)
        # Flatten transparency onto white; these are product cut-outs and a
        # JPEG cannot carry an alpha channel.
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            bg = Image.new("RGB", im.size, (255, 255, 255))
            bg.paste(im, mask=im.split()[-1])
            im = bg
        else:
            im = im.convert("RGB")

        if im.width > MAX_W:
            im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)

        dst = OUT / f"{sku}.jpg"
        im.save(dst, "JPEG", quality=QUALITY, optimize=True, progressive=True)

        saved_before += src.stat().st_size
        saved_after += dst.stat().st_size
        print(f"  {sku:12} {src.stat().st_size / 1e6:6.2f} MB -> "
              f"{dst.stat().st_size / 1e3:6.1f} KB   {name}")

    print(f"\n{len(CATALOGUE) - len(missing)} images written to {OUT}")
    print(f"total {saved_before / 1e6:.1f} MB -> {saved_after / 1e6:.2f} MB")
    if missing:
        print("\nMISSING source files:")
        for m in missing:
            print(f"  {m}")
    if unpriced:
        print("\nNO PRICE in the supplied material (not seeded, image imported only):")
        for u in unpriced:
            print(f"  {u}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
