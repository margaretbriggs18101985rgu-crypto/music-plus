"""Native Android visual/interaction checks; fixtures are explicitly not audio playback.

Requires an installed standalone Debug APK and an emulator/device. Captures actual
screens and a transition recording; no web preview or fabricated audio is used.
"""
from __future__ import annotations

import argparse
import json
import re
import struct
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--adb', default='adb')
    parser.add_argument('--serial', default='emulator-5554')
    parser.add_argument('--package', default='io.github.musicplus.player')
    parser.add_argument('--output', type=Path, default=Path('build/motion-qa'))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    prefix = [args.adb, '-s', args.serial]
    target = args.package + '/cn.toside.music.mobile.vinyl.VinylPreviewActivity'

    def adb(*command: str) -> str:
        return subprocess.check_output(prefix + list(command), encoding='utf-8', errors='replace', timeout=35).strip()

    def action(name: str) -> None:
        adb('shell', 'am', 'start', '-W', '-n', target, '--es', 'vinyl_action', name)

    def nodes() -> list[dict[str, str]]:
        for _ in range(3):
            dumped = adb('shell', 'uiautomator', 'dump', '/sdcard/musicplus-motion.xml')
            if 'dumped to' not in dumped:
                continue
            xml = adb('shell', 'cat', '/sdcard/musicplus-motion.xml')
            (args.output / 'last-window.xml').write_text(xml, encoding='utf-8')
            return [node.attrib for node in ET.fromstring(xml).iter('node')]
        raise RuntimeError('Android did not provide a fresh UI hierarchy')

    def wait_label(label: str) -> dict[str, str]:
        for _ in range(4):
            for node in nodes():
                if node.get('content-desc') == label or node.get('text') == label:
                    return node
        raise AssertionError('Missing UI target: ' + label)

    def tap(label: str) -> None:
        node = wait_label(label)
        left, top, right, bottom = map(int, re.findall(r'\d+', node['bounds']))
        assert right > left and bottom > top, node
        adb('shell', 'input', 'tap', str((left + right) // 2), str((top + bottom) // 2))

    def capture(name: str) -> tuple[int, int]:
        # ADB cannot drive Compose's test clock. Allow the bounded 640ms visual
        # transition to settle before recording a final-state layout screenshot.
        time.sleep(.75)
        data = subprocess.check_output(prefix + ['exec-out', 'screencap', '-p'], timeout=30)
        (args.output / (name + '.png')).write_bytes(data)
        return struct.unpack('>II', data[16:24])

    auto = adb('shell', 'settings', 'get', 'system', 'accelerometer_rotation')
    rotation = adb('shell', 'settings', 'get', 'system', 'user_rotation')
    results: dict[str, object] = {'kind': 'native Debug fixture', 'audio_playback_tested': False}
    try:
        adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0')
        adb('shell', 'settings', 'put', 'system', 'user_rotation', '0')
        adb('shell', 'am', 'start', '-W', '-n', target)
        action('fixture-multiple')
        action('buffer')
        wait_label('返回黑胶唱片')
        wait_label('而我们在音乐里相遇')
        results['portrait_size'] = capture('portrait-multiple')
        # These are real UI clicks, not intent commands substituting for callbacks.
        tap('返回黑胶唱片')
        wait_label('打开歌词页面')
        capture('portrait-vinyl')
        tap('打开歌词页面')
        wait_label('返回黑胶唱片')
        results['explicit_return_roundtrip'] = True
        # The actual record is also an entry target.
        tap('返回黑胶唱片')
        record = wait_label('专辑封面')
        left, top, right, bottom = map(int, re.findall(r'\d+', record['bounds']))
        adb('shell', 'input', 'tap', str((left + right) // 2), str((top + bottom) // 2))
        wait_label('返回黑胶唱片')
        results['record_tap_entry'] = True

        action('fixture-end')
        wait_label('晚安，明天见')
        capture('last-line')
        action('fixture-start')
        wait_label('夜色慢慢落下')
        capture('first-line')
        results['seek_boundaries'] = True

        action('fixture-multiple')
        adb('shell', 'settings', 'put', 'system', 'user_rotation', '1')
        wait_label('返回黑胶唱片')
        width, height = capture('landscape-multiple')
        assert width > height, (width, height)
        wait_label('而我们在音乐里相遇')
        for label in ('播放模式', '上一首', '下一首', '更多播放设置'):
            node = wait_label(label)
            left, top, right, bottom = map(int, re.findall(r'\d+', node['bounds']))
            assert 0 <= left < right <= width and 0 <= top < bottom <= height, node
        results['landscape_size'] = [width, height]
        # The play button is centered, with equally wide information/action wings.
        play = wait_label('继续演示动画')
        dock = next(node for node in nodes() if node.get('content-desc', '').startswith('播放控制栏'))
        px = list(map(int, re.findall(r'\d+', play['bounds'])))
        dx = list(map(int, re.findall(r'\d+', dock['bounds'])))
        assert abs((px[0] + px[2]) / 2 - (dx[0] + dx[2]) / 2) < 5, (play, dock)
        # A button press must not bubble into the dock's empty-area hide action.
        tap('取消喜欢')
        wait_label('返回黑胶唱片')
        tap('喜欢')
        dock = next(node for node in nodes() if node.get('content-desc', '').startswith('播放控制栏'))
        left, top, right, bottom = map(int, re.findall(r'\d+', dock['bounds']))
        before = wait_label('而我们在音乐里相遇')['bounds']
        adb('shell', 'input', 'tap', str((left + right) // 2), str(bottom - 3))
        for _ in range(4):
            if not any(node.get('content-desc') == '返回黑胶唱片' for node in nodes()):
                break
        else:
            raise AssertionError('Empty dock space did not hide the chrome')
        after = wait_label('而我们在音乐里相遇')['bounds']
        assert before == after, (before, after)
        capture('landscape-hidden')
        adb('shell', 'input', 'tap', str(width // 2), str(height // 2))
        wait_label('返回黑胶唱片')
        results['symmetric_dock_and_hide_reveal_without_lyric_shift'] = True
        tap('返回黑胶唱片')
        wait_label('打开歌词页面')
        capture('landscape-vinyl')
        tap('打开歌词页面')
        action('fixture-single')
        capture('landscape-single')
        results['landscape_roundtrip'] = True

        adb('shell', 'settings', 'put', 'system', 'user_rotation', '0')
        action('fixture-multiple')
        action('resume')
        adb('shell', 'dumpsys', 'gfxinfo', args.package, 'reset')
        recorder = subprocess.Popen(prefix + ['shell', 'screenrecord', '--time-limit', '12', '--bit-rate', '5000000', '/sdcard/musicplus-motion.mp4'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        time.sleep(.8)
        for name in ['fixture-next'] * 4 + ['fixture-previous'] * 2 + ['fixture-next'] * 3:
            action(name)
            time.sleep(.36)
        action('fixture-single')
        action('fixture-next')
        action('fixture-next')
        action('fixture-previous')
        wait_label('返回黑胶唱片')
        recorder.communicate(timeout=20)
        adb('pull', '/sdcard/musicplus-motion.mp4', str(args.output / 'lyric-transitions.mp4'))
        (args.output / 'gfxinfo.txt').write_text(adb('shell', 'dumpsys', 'gfxinfo', args.package, 'framestats'), encoding='utf-8')
        action('buffer')
        capture('portrait-single')
        action('fixture-reduced')
        action('fixture-next')
        capture('reduced-motion')
        results['rapid_changes_and_reduced_motion'] = True
        results['result'] = 'passed'
    finally:
        for key, value in [('accelerometer_rotation', auto), ('user_rotation', rotation)]:
            adb('shell', 'settings', 'delete' if value == 'null' else 'put', 'system', key, *([] if value == 'null' else [value]))
        (args.output / 'fixture-results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
