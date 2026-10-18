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
    cached_nodes: list[dict[str, str]] | None = None

    def adb(*command: str) -> str:
        nonlocal cached_nodes
        if len(command) > 1 and command[1] in ('input', 'am', 'settings'):
            cached_nodes = None
        return subprocess.check_output(prefix + list(command), encoding='utf-8', errors='replace', timeout=35).strip()

    def action(name: str) -> None:
        adb('shell', 'am', 'start', '-W', '-n', target, '--es', 'vinyl_action', name)

    def nodes(refresh: bool = False) -> list[dict[str, str]]:
        nonlocal cached_nodes
        if cached_nodes is not None and not refresh:
            return cached_nodes
        for _ in range(3):
            dumped = adb('shell', 'uiautomator', 'dump', '/sdcard/musicplus-motion.xml')
            if 'dumped to' not in dumped:
                continue
            xml = adb('shell', 'cat', '/sdcard/musicplus-motion.xml')
            (args.output / 'last-window.xml').write_text(xml, encoding='utf-8')
            cached_nodes = [node.attrib for node in ET.fromstring(xml).iter('node')]
            return cached_nodes
        raise RuntimeError('Android did not provide a fresh UI hierarchy')

    def wait_label(label: str) -> dict[str, str]:
        for attempt in range(4):
            snapshot = nodes(refresh=attempt > 0)
            # Android shows this one-time system tutorial on entering immersive mode.
            tutorial = next((node for node in snapshot if node.get('text') == 'Got it'), None)
            if tutorial is not None:
                left, top, right, bottom = map(int, re.findall(r'\d+', tutorial['bounds']))
                adb('shell', 'input', 'tap', str((left + right) // 2), str((top + bottom) // 2))
                continue
            for node in snapshot:
                if node.get('content-desc') == label or node.get('text') == label:
                    return node
        raise AssertionError('Missing UI target: ' + label)

    def tap(label: str) -> None:
        node = wait_label(label)
        left, top, right, bottom = map(int, re.findall(r'\d+', node['bounds']))
        assert right > left and bottom > top, node
        adb('shell', 'input', 'tap', str((left + right) // 2), str((top + bottom) // 2))

    def capture(name: str) -> tuple[int, int]:
        nonlocal cached_nodes
        # ADB cannot drive Compose's test clock. Allow the bounded 640ms visual
        # transition to settle before recording a final-state layout screenshot.
        time.sleep(.75)
        cached_nodes = None
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
        wait_label('收起播放器')
        action('fixture-multiple')
        action('buffer')
        wait_label('而我们在音乐里相遇')
        results['portrait_size'] = capture('portrait-multiple')
        def assert_context() -> None:
            viewport = wait_label('多排歌词区域')
            focused = wait_label('而我们在音乐里相遇')
            vp = list(map(int, re.findall(r'\d+', viewport['bounds'])))
            fp = list(map(int, re.findall(r'\d+', focused['bounds'])))
            assert abs((fp[1] + fp[3]) / 2 - (vp[1] + vp[3]) / 2) <= 5, (viewport, focused)
            for text in ('每一颗星都留在自己的轨道', '把这一刻轻轻收藏'):
                line = wait_label(text)
                bounds = list(map(int, re.findall(r'\d+', line['bounds'])))
                assert vp[1] <= bounds[1] < bounds[3] <= vp[3], (viewport, line)

        def switch_from_lyrics() -> None:
            # A real tap on the lyric stage must trigger exactly one page switch.
            tap('而我们在音乐里相遇')
            wait_label('专辑封面')

        assert_context()
        results['portrait_centered_with_context'] = True
        assert not any(n.get('content-desc') in ('返回黑胶唱片', '打开歌词页面') for n in nodes())
        switch_from_lyrics()
        capture('portrait-vinyl')
        tap('专辑封面')
        assert_context()
        results['tap_roundtrip_without_mode_buttons'] = True

        action('fixture-end')
        wait_label('晚安，明天见')
        capture('last-line')
        action('fixture-start')
        wait_label('夜色慢慢落下')
        capture('first-line')
        results['seek_boundaries'] = True

        action('fixture-multiple')
        adb('shell', 'settings', 'put', 'system', 'user_rotation', '1')
        width, height = capture('landscape-multiple')
        assert width > height, (width, height)
        wait_label('而我们在音乐里相遇')
        assert_context()
        for label in ('上一首', '下一首', '取消喜欢', '更多播放设置'):
            node = wait_label(label)
            left, top, right, bottom = map(int, re.findall(r'\d+', node['bounds']))
            assert 0 <= left < right <= width and 0 <= top < bottom <= height, node
        results['landscape_size'] = [width, height]
        def assert_four_controls() -> None:
            centers = []
            for label in ('上一首', '继续演示动画', '下一首', '取消喜欢'):
                bounds = list(map(int, re.findall(r'\d+', wait_label(label)['bounds'])))
                centers.append(((bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2))
            gaps = [centers[i + 1][0] - centers[i][0] for i in range(3)]
            assert min(gaps) > 0 and max(gaps) - min(gaps) <= 4, centers
            assert max(p[1] for p in centers) - min(p[1] for p in centers) <= 3, centers
            assert not any(n.get('content-desc') in ('播放模式', '播放队列', '歌曲评论') for n in nodes())

        assert_four_controls()
        # Buttons must not bubble into the surrounding page-switch gesture.
        tap('取消喜欢')
        wait_label('多排歌词区域')
        tap('喜欢')
        switch_from_lyrics()
        capture('landscape-vinyl')
        assert_four_controls()
        assert_context()
        title = wait_label('星光之间')
        record = wait_label('专辑封面')
        title_bounds = list(map(int, re.findall(r'\d+', title['bounds'])))
        record_bounds = list(map(int, re.findall(r'\d+', record['bounds'])))
        assert title_bounds[3] <= record_bounds[1], (title, record)
        assert title_bounds[0] < width / 2, title
        grooves = wait_label('黑胶唱片沟槽')
        groove_bounds = list(map(int, re.findall(r'\d+', grooves['bounds'])))
        # Include title, artist and the full record, rather than just its center label.
        # The stage has 14dp of space below the record; visible ink may differ slightly.
        group_center_y = (title_bounds[1] + groove_bounds[3]) / 2
        assert abs(group_center_y - height / 2) <= height * .025, (title, grooves, height)
        play_bounds = list(map(int, re.findall(r'\d+', wait_label('继续演示动画')['bounds'])))
        previous_bounds = list(map(int, re.findall(r'\d+', wait_label('上一首')['bounds'])))
        assert abs((play_bounds[3] - play_bounds[1]) - (previous_bounds[3] - previous_bounds[1])) <= 2
        results['landscape_record_group_center_y'] = group_center_y
        results['landscape_record_group_centered_and_compact_play_button'] = True
        tap('专辑封面')
        results['landscape_four_controls_and_metadata_above_record'] = True
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
        wait_label('把这一刻轻轻收藏')
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
