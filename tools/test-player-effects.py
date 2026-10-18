"""Compare actual Debug screenshots for particle count, drift and text pulse switches.

Requires Pillow and an installed standalone Debug APK. The preview activity supplies
text fixtures; this does not claim to verify audio playback or measured musical beats.
"""
from __future__ import annotations

import argparse
import io
import json
from pathlib import Path
import subprocess
import time

from PIL import Image, ImageChops


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--adb', default='adb')
    parser.add_argument('--serial', default='emulator-5554')
    parser.add_argument('--package', default='io.github.musicplus.player')
    parser.add_argument('--output', type=Path, default=Path('build/player-effects-qa'))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    prefix = [args.adb, '-s', args.serial]
    target = args.package + '/cn.toside.music.mobile.vinyl.VinylPreviewActivity'

    def adb(*command: str) -> str:
        return subprocess.check_output(prefix + list(command), encoding='utf-8', errors='replace', timeout=35).strip()

    def action(name: str) -> None:
        adb('shell', 'am', 'start', '-W', '-n', target, '--es', 'vinyl_action', name)

    def capture(name: str) -> Image.Image:
        time.sleep(.65)
        data = subprocess.check_output(prefix + ['exec-out', 'screencap', '-p'], timeout=30)
        (args.output / (name + '.png')).write_bytes(data)
        return Image.open(io.BytesIO(data)).convert('RGB')

    def sky(image: Image.Image) -> Image.Image:
        w, h = image.size
        return image.crop((0, int(h * .12), int(w * .05), int(h * .70)))

    def lit_pixels(image: Image.Image) -> int:
        return sum(max(pixel) >= 16 for pixel in image.getdata())

    def difference(first: Image.Image, second: Image.Image) -> int:
        return sum(max(pixel) > 3 for pixel in ImageChops.difference(first, second).getdata())

    auto = adb('shell', 'settings', 'get', 'system', 'accelerometer_rotation')
    rotation = adb('shell', 'settings', 'get', 'system', 'user_rotation')
    results: dict[str, object] = {'kind': 'native Debug screenshot comparison', 'audio_playback_tested': False}
    try:
        adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0')
        adb('shell', 'settings', 'put', 'system', 'user_rotation', '0')
        adb('shell', 'am', 'start', '-W', '-n', target)
        action('fixture-single')
        action('buffer')
        action('fixture-background-on')
        action('ambient-low')
        low = sky(capture('particles-low'))
        action('ambient-high')
        high = sky(capture('particles-high'))
        moving = sky(capture('particles-moving'))
        results['low_lit_pixels'] = lit_pixels(low)
        results['high_lit_pixels'] = lit_pixels(high)
        assert lit_pixels(high) > lit_pixels(low) * 2, results
        results['drift_changed_pixels'] = difference(high, moving)
        assert difference(high, moving) > 100, results
        action('fixture-background-off')
        still = sky(capture('particles-frozen'))
        still_again = sky(capture('particles-frozen-again'))
        results['frozen_changed_pixels'] = difference(still, still_again)
        assert difference(still, still_again) == 0, results
        action('ambient-off')
        off = sky(capture('particles-off'))
        results['off_lit_pixels'] = lit_pixels(off)
        assert lit_pixels(off) == 0, results

        # Hold stars still while checking only the lyric region. This also proves
        # the pulse can run independently of the background-motion switch.
        action('ambient-high')
        action('fixture-pulse-on')
        action('resume')
        time.sleep(1.1)  # The one-time play/pause background tint takes 900ms.
        first = capture('pulse-on')
        second = capture('pulse-on-next')
        w, h = first.size
        region = (int(w * .16), int(h * .16), int(w * .84), int(h * .65))
        results['pulse_changed_pixels'] = difference(first.crop(region), second.crop(region))
        assert results['pulse_changed_pixels'] > 100, results
        action('fixture-pulse-off')
        first = capture('pulse-off')
        second = capture('pulse-off-next')
        results['pulse_off_changed_pixels'] = difference(first.crop(region), second.crop(region))
        assert results['pulse_off_changed_pixels'] == 0, results
        results['result'] = 'passed'
    finally:
        action('buffer')
        action('fixture-pulse-on')
        action('fixture-background-on')
        action('ambient-auto')
        for key, value in [('accelerometer_rotation', auto), ('user_rotation', rotation)]:
            adb('shell', 'settings', 'delete' if value == 'null' else 'put', 'system', key, *([] if value == 'null' else [value]))
        (args.output / 'effects-results.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
    print(json.dumps(results, indent=2))


if __name__ == '__main__':
    main()
