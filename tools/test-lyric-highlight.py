"""Pixel QA of the real Compose wrapped-lyric renderer; labelled fixtures, no audio."""
from __future__ import annotations

import argparse
import io
import json
from pathlib import Path
import re
import subprocess
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--serial', default='emulator-5554')
    parser.add_argument('--output', type=Path, default=Path('build/lyric-highlight-qa'))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    prefix = ['adb', '-s', args.serial]
    target = 'io.github.musicplus.player/cn.toside.music.mobile.vinyl.VinylPreviewActivity'

    def adb(*command: str) -> str:
        return subprocess.check_output(prefix + list(command), encoding='utf-8', errors='replace', timeout=40).strip()

    def capture(name: str) -> np.ndarray:
        png = subprocess.check_output(prefix + ['exec-out', 'screencap', '-p'], timeout=30)
        (args.output / (name + '.png')).write_bytes(png)
        return np.array(Image.open(io.BytesIO(png)).convert('RGB'))

    def fixture(value: float) -> tuple[np.ndarray, list[int]]:
        adb('shell', 'am', 'start', '-W', '-n', target,
            '--es', 'vinyl_action', 'fixture-highlight', '--ed', 'vinyl_value', str(value))
        # Dumping synchronizes with the actual UI becoming idle. No guessed text coordinates.
        adb('shell', 'uiautomator', 'dump', '/sdcard/lyric-highlight.xml')
        xml = adb('shell', 'cat', '/sdcard/lyric-highlight.xml')
        (args.output / 'last-window.xml').write_text(xml, encoding='utf-8')
        nodes = [node for node in ET.fromstring(xml).iter('node')
                 if node.get('content-desc') == '铁盒的钥匙我找不到' or node.get('text') == '铁盒的钥匙我找不到']
        assert nodes, 'Missing labelled lyric text'
        bounds = list(map(int, re.findall(r'\d+', nodes[0].get('bounds', ''))))
        return capture(f'progress-{value:.2f}'), bounds

    adb('shell', 'am', 'start', '-W', '-n', target)
    samples: dict[float, np.ndarray] = {}
    bounds: list[int] = []
    for value in [0.0, .25, .5, .75, .9, 1.0]:
        samples[value], bounds = fixture(value)
    left, top, right, bottom = bounds

    def white(pixels: np.ndarray) -> np.ndarray:
        rgb = pixels[top:bottom, left:right].astype(int)
        return (rgb.min(axis=2) > 220) & ((rgb.max(axis=2) - rgb.min(axis=2)) < 25)

    masks = {value: white(pixels) for value, pixels in samples.items()}
    occupied = np.flatnonzero(masks[1.0].sum(axis=1) > 5)
    bands = np.split(occupied, np.where(np.diff(occupied) > 8)[0] + 1)
    bands = [band for band in bands if len(band) > 12]
    assert len(bands) >= 2, f'Fixture must actually wrap: {len(bands)} rows, bounds={bounds}'
    rows = [(int(band[0]), int(band[-1]) + 1) for band in bands]
    counts = {str(value): [int(mask[start:end].sum()) for start, end in rows]
              for value, mask in masks.items()}
    assert counts['0.25'][0] > counts['0.0'][0] + 100
    assert counts['0.25'][1] <= counts['0.0'][1] + 5, 'Second row lit before first row finished'
    assert counts['0.9'][0] >= counts['1.0'][0] * .98, 'Completed row lost its highlight'
    assert 5 < counts['0.9'][1] < counts['1.0'][1], 'Second row must fill only after row one'
    previous = masks[0.0]
    for value in [.25, .5, .75, .9, 1.0]:
        lost = int((previous & ~masks[value]).sum())
        assert lost <= 5, f'Highlight blinked backwards at {value}: {lost} pixels lost'
        previous = masks[value]
    # Fixed position/pause must not flash or restart on an ordinary state refresh.
    repeated, _ = fixture(.5)
    assert np.array_equal(white(repeated), masks[.5]), 'Paused highlight changed on refresh'
    result = {'kind': 'real Compose pixel assertions with controlled lyric time',
              'audio_playback_tested': False, 'bounds': bounds, 'rows': rows,
              'white_pixels_by_row': counts, 'wrapped_order_and_stability_passed': True}
    (args.output / 'results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
