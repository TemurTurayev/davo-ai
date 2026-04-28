#!/bin/bash
cd /Users/temur/Desktop/Claude/Hackathon_2/davo-ai/data/tb_pills/

UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

download() {
    local out="$1"
    local url="$2"
    if [ -f "$out" ] && [ $(stat -f%z "$out" 2>/dev/null || echo 0) -gt 5000 ]; then
        echo "SKIP $out"
        return
    fi
    echo "GET $out"
    curl -sL -A "$UA" -o "$out" "$url"
    sleep 1.2
}

# === PYRAZINAMIDE — large white oval tablets ===
download "pyrazinamide/pyrazinamide_pexels_004_oval.jpg" "https://images.pexels.com/photos/3683108/pexels-photo-3683108.jpeg"
download "pyrazinamide/pyrazinamide_pexels_005_oval.jpg" "https://images.pexels.com/photos/4210606/pexels-photo-4210606.jpeg"
download "pyrazinamide/pyrazinamide_pexels_006_oval.jpg" "https://images.pexels.com/photos/4210616/pexels-photo-4210616.jpeg"
download "pyrazinamide/pyrazinamide_pexels_007_oblong.jpg" "https://images.pexels.com/photos/9742855/pexels-photo-9742855.jpeg"
download "pyrazinamide/pyrazinamide_pexels_008_oblong.jpg" "https://images.pexels.com/photos/9742881/pexels-photo-9742881.jpeg"
download "pyrazinamide/pyrazinamide_pexels_009_white_lg.jpg" "https://images.pexels.com/photos/3683068/pexels-photo-3683068.jpeg"
download "pyrazinamide/pyrazinamide_pexels_010_white.jpg" "https://images.pexels.com/photos/7083682/pexels-photo-7083682.jpeg"
download "pyrazinamide/pyrazinamide_pexels_011_white_blister.jpg" "https://images.pexels.com/photos/9742768/pexels-photo-9742768.jpeg"
download "pyrazinamide/pyrazinamide_pexels_012_assorted.jpg" "https://images.pexels.com/photos/7615407/pexels-photo-7615407.jpeg"

# === COMBO FDC — extras ===
download "combo_fdc/combo_pexels_012_blister_pack.jpg" "https://images.pexels.com/photos/12672359/pexels-photo-12672359.jpeg"
download "combo_fdc/combo_pexels_013_pills_bottle.jpg" "https://images.pexels.com/photos/15525818/pexels-photo-15525818.jpeg"
download "combo_fdc/combo_pexels_014_assorted.jpg" "https://images.pexels.com/photos/3683081/pexels-photo-3683081.jpeg"
download "combo_fdc/combo_pexels_015_heart_arrangement.jpg" "https://images.pexels.com/photos/12512671/pexels-photo-12512671.jpeg"
download "combo_fdc/combo_pexels_016_pharmacy_bottle.jpg" "https://images.pexels.com/photos/29205871/pexels-photo-29205871.jpeg"
download "combo_fdc/combo_pexels_017_blister_herbal.jpg" "https://images.pexels.com/photos/7526072/pexels-photo-7526072.jpeg"
download "combo_fdc/combo_pexels_018_colorful.jpg" "https://images.pexels.com/photos/3873150/pexels-photo-3873150.jpeg"
download "combo_fdc/combo_pexels_019_capsules.jpg" "https://images.pexels.com/photos/3873147/pexels-photo-3873147.jpeg"
download "combo_fdc/combo_pexels_020_supplements.jpg" "https://images.pexels.com/photos/7615573/pexels-photo-7615573.jpeg"
download "combo_fdc/combo_pexels_021_orange_bg.jpg" "https://images.pexels.com/photos/3683086/pexels-photo-3683086.jpeg"
download "combo_fdc/combo_pexels_022_doctor.jpg" "https://images.pexels.com/photos/4989187/pexels-photo-4989187.jpeg"

# === RIFAMPICIN — extras ===
download "rifampicin/rifampicin_pexels_010_capsules.jpg" "https://images.pexels.com/photos/31406904/pexels-photo-31406904.jpeg"

# === ETHAMBUTOL — extras ===
download "ethambutol/ethambutol_pexels_011_yellow_blue_bg.jpg" "https://images.pexels.com/photos/17604768/pexels-photo-17604768.jpeg"
echo "=== Done batch 2 ==="
