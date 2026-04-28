#!/bin/bash
# Batch download script for TB pill images from public sources
# Pexels license: https://www.pexels.com/license/ (free for commercial/non-commercial use, no attribution required, no modification of identifiable people without permission)
# Wikimedia Commons: CC BY-SA 4.0, CC BY 3.0 / Public Domain — see metadata.json per folder

cd /Users/temur/Desktop/Claude/Hackathon_2/davo-ai/data/tb_pills/

UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

download() {
    local out="$1"
    local url="$2"
    if [ -f "$out" ] && [ $(stat -f%z "$out" 2>/dev/null || echo 0) -gt 5000 ]; then
        echo "SKIP $out (already exists)"
        return
    fi
    echo "GET $out <- $url"
    curl -sL -A "$UA" -o "$out" "$url"
    sleep 1.5
}

# === RIFAMPICIN (red-orange capsules) ===
# Pexels search: red capsule, red orange capsule, red-orange pill
download "rifampicin/rifampicin_pexels_002_red_blister.jpg" "https://images.pexels.com/photos/7033945/pexels-photo-7033945.jpeg"
download "rifampicin/rifampicin_pexels_003_red_scattered.jpg" "https://images.pexels.com/photos/7904404/pexels-photo-7904404.jpeg"
download "rifampicin/rifampicin_pexels_004_red_yellow_bg.jpg" "https://images.pexels.com/photos/9743101/pexels-photo-9743101.jpeg"
download "rifampicin/rifampicin_pexels_005_red_yellow.jpg" "https://images.pexels.com/photos/9742810/pexels-photo-9742810.jpeg"
download "rifampicin/rifampicin_pexels_006_red_pink_bg.jpg" "https://images.pexels.com/photos/9742904/pexels-photo-9742904.jpeg"
download "rifampicin/rifampicin_pexels_007_red_blue.jpg" "https://images.pexels.com/photos/7904444/pexels-photo-7904444.jpeg"
download "rifampicin/rifampicin_pexels_008_hand_capsule.jpg" "https://images.pexels.com/photos/15038478/pexels-photo-15038478.jpeg"
download "rifampicin/rifampicin_pexels_009_red_white.jpg" "https://images.pexels.com/photos/13534594/pexels-photo-13534594.jpeg"

# === ISONIAZID (white round tablets) ===
download "isoniazid/isoniazid_pexels_001_white_pink.jpg" "https://images.pexels.com/photos/3683043/pexels-photo-3683043.jpeg"
download "isoniazid/isoniazid_pexels_002_white_yellow.jpg" "https://images.pexels.com/photos/3683111/pexels-photo-3683111.jpeg"
download "isoniazid/isoniazid_pexels_003_white_blue.jpg" "https://images.pexels.com/photos/3683036/pexels-photo-3683036.jpeg"
download "isoniazid/isoniazid_pexels_004_white_close.jpg" "https://images.pexels.com/photos/5987970/pexels-photo-5987970.jpeg"
download "isoniazid/isoniazid_pexels_005_white_blue_textile.jpg" "https://images.pexels.com/photos/3683079/pexels-photo-3683079.jpeg"
download "isoniazid/isoniazid_pexels_006_white_blue_surf.jpg" "https://images.pexels.com/photos/9742859/pexels-photo-9742859.jpeg"
download "isoniazid/isoniazid_pexels_007_white_spilled.jpg" "https://images.pexels.com/photos/5699522/pexels-photo-5699522.jpeg"
download "isoniazid/isoniazid_pexels_008_white_blister.jpg" "https://images.pexels.com/photos/7277984/pexels-photo-7277984.jpeg"
download "isoniazid/isoniazid_pexels_009_white_blue.jpg" "https://images.pexels.com/photos/13105348/pexels-photo-13105348.jpeg"

# === PYRAZINAMIDE (white round/oval larger tablets) ===
# Reuse white pill set from above (PZA looks similar to INH but larger)
download "pyrazinamide/pyrazinamide_pexels_001_white_scatter.jpg" "https://images.pexels.com/photos/3683112/pexels-photo-3683112.jpeg"
download "pyrazinamide/pyrazinamide_pexels_002_white_round.jpg" "https://images.pexels.com/photos/5742325/pexels-photo-5742325.jpeg"
download "pyrazinamide/pyrazinamide_pexels_003_pink_pills.jpg" "https://images.pexels.com/photos/4058264/pexels-photo-4058264.jpeg"

# === ETHAMBUTOL (yellow tablets) ===
download "ethambutol/ethambutol_pexels_001_yellow.jpg" "https://images.pexels.com/photos/7034124/pexels-photo-7034124.jpeg"
download "ethambutol/ethambutol_pexels_002_yellow.jpg" "https://images.pexels.com/photos/4132854/pexels-photo-4132854.jpeg"
download "ethambutol/ethambutol_pexels_003_yellow.jpg" "https://images.pexels.com/photos/17604768/pexels-photo-17604768.jpeg"
download "ethambutol/ethambutol_pexels_004_yellow.jpg" "https://images.pexels.com/photos/9742775/pexels-photo-9742775.jpeg"
download "ethambutol/ethambutol_pexels_005_yellow.jpg" "https://images.pexels.com/photos/17553953/pexels-photo-17553953.jpeg"
download "ethambutol/ethambutol_pexels_006_yellow.jpg" "https://images.pexels.com/photos/7033658/pexels-photo-7033658.jpeg"
download "ethambutol/ethambutol_pexels_007_yellow.jpg" "https://images.pexels.com/photos/9742741/pexels-photo-9742741.jpeg"
download "ethambutol/ethambutol_pexels_008_yellow.jpg" "https://images.pexels.com/photos/35970039/pexels-photo-35970039.jpeg"
download "ethambutol/ethambutol_pexels_009_yellow.jpg" "https://images.pexels.com/photos/9742749/pexels-photo-9742749.jpeg"
download "ethambutol/ethambutol_pexels_010_yellow.jpg" "https://images.pexels.com/photos/30385882/pexels-photo-30385882.jpeg"

# === COMBO FDC (mixed colors, blister packs) ===
download "combo_fdc/combo_pexels_004_multicolor_blister.jpg" "https://images.pexels.com/photos/12672390/pexels-photo-12672390.jpeg"
download "combo_fdc/combo_pexels_005_blister.jpg" "https://images.pexels.com/photos/4210607/pexels-photo-4210607.jpeg"
download "combo_fdc/combo_pexels_006_blister.jpg" "https://images.pexels.com/photos/9742738/pexels-photo-9742738.jpeg"
download "combo_fdc/combo_pexels_007_pills_blister.jpg" "https://images.pexels.com/photos/9742754/pexels-photo-9742754.jpeg"
download "combo_fdc/combo_pexels_008_pink_pills.jpg" "https://images.pexels.com/photos/4210613/pexels-photo-4210613.jpeg"
download "combo_fdc/combo_pexels_009_assorted.jpg" "https://images.pexels.com/photos/4210615/pexels-photo-4210615.jpeg"
download "combo_fdc/combo_pexels_010_pharmacy.jpg" "https://images.pexels.com/photos/5207322/pexels-photo-5207322.jpeg"
download "combo_fdc/combo_pexels_011_pills_pharmacy.jpg" "https://images.pexels.com/photos/51929/medications-cure-tablets-pharmacy-51929.jpeg"

echo "=== Download complete ==="
ls -la rifampicin/ isoniazid/ pyrazinamide/ ethambutol/ combo_fdc/ | grep -E '\.jpg$|\.jpeg$|^total' | head -100
