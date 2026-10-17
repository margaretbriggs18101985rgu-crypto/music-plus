"""Reproducible Android Debug animation checks. No simulated audio assertions."""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import time
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--adb', default='adb')
    parser.add_argument('--serial', default='emulator-5554')
    parser.add_argument('--output', type=Path, default=Path('build/vinyl-validation'))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    target = 'cn.toside.music.mobile/.vinyl.VinylPreviewActivity'

    def adb(*command: str) -> str:
        return subprocess.check_output([args.adb, '-s', args.serial, *command], text=True, encoding='utf-8', errors='replace')

    def action(name: str) -> None:
        adb('shell', 'am', 'start', '-W', '-n', target, '--es', 'vinyl_action', name)

    def snapshot() -> float:
        action('snapshot')
        lines = adb('logcat', '-d', '-s', 'VinylPreview:I', '-v', 'brief')
        matches = re.findall(r'demo=true angle=([\d.]+) playing=(true|false)', lines)
        if not matches:
            raise RuntimeError('The Debug animation harness did not report its angle.')
        return float(matches[-1][0])

    def capture(name: str) -> None:
        remote = '/sdcard/lx-vinyl-debug.png'
        adb('shell', 'screencap', '-p', remote)
        adb('pull', remote, str(args.output / name))

    adb('shell', 'am', 'start', '-W', '-n', target)
    time.sleep(1)
    action('buffer')
    first = snapshot()
    capture('vinyl-paused.png')
    time.sleep(1)
    second = snapshot()
    assert abs(second - first) < .01, f'Paused angle moved: {first} -> {second}'

    action('resume')
    time.sleep(1.5)
    moving = snapshot()
    advance = (moving - second) % 360
    assert 25 < advance < 130, f'Unexpected clockwise advance: {advance}'
    capture('vinyl-playing.png')

    action('buffer')
    time.sleep(.2)
    paused = snapshot()
    time.sleep(1)
    held = snapshot()
    assert abs(held - paused) < .01, f'Pause did not hold angle: {paused} -> {held}'

    action('resume')
    time.sleep(.5)
    resumed = snapshot()
    resume_delta = (resumed - held) % 360
    assert 0 < resume_delta < 90, f'Resume jumped or reset angle: {held} -> {resumed}'

    before_refresh = snapshot()
    action('refresh')
    after_refresh = snapshot()
    refresh_delta = (after_refresh - before_refresh) % 360
    assert 0 < refresh_delta < 90, f'Metadata refresh reset angle: {before_refresh} -> {after_refresh}'

    action('buffer')
    capture('vinyl-final-paused.png')
    result = {
        'kind': 'Android native Debug animation harness',
        'audio_playback_tested': False,
        'serial': args.serial,
        'paused_stable': [first, second],
        'clockwise_advance_degrees': advance,
        'pause_hold': [paused, held],
        'resume_advance_degrees': resume_delta,
        'metadata_refresh_advance_degrees': refresh_delta,
        'result': 'passed',
    }
    (args.output / 'animation-results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
