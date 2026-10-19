"""Check real Android tap routing and adaptive lyric layout using labelled Debug fixtures.

This exercises the Compose UI, not audio playback. Settings persistence and audio
motion gating are covered separately by the settings and native unit tests.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import struct
import subprocess
import time
import xml.etree.ElementTree as ET


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--adb', default='adb')
    parser.add_argument('--serial', default='emulator-5554')
    parser.add_argument('--output', type=Path, default=Path('build/adaptive-player-qa'))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    prefix = [args.adb, '-s', args.serial]
    package = 'io.github.musicplus.player'
    target = package + '/cn.toside.music.mobile.vinyl.VinylPreviewActivity'
    results: dict[str, object] = {'kind': 'native Android Debug UI fixture', 'audio_playback_tested': False}

    def adb(*command: str) -> str:
        return subprocess.check_output(prefix + list(command), encoding='utf-8', errors='replace', timeout=40).strip()

    def action(name: str) -> None:
        adb('shell', 'am', 'start', '-W', '-n', target, '--es', 'vinyl_action', name)

    def snapshot() -> list[dict[str, str]]:
        adb('shell', 'uiautomator', 'dump', '/sdcard/musicplus-viewport.xml')
        xml = adb('shell', 'cat', '/sdcard/musicplus-viewport.xml')
        (args.output / 'last-window.xml').write_text(xml, encoding='utf-8')
        return [n.attrib for n in ET.fromstring(xml).iter('node')]

    def find(nodes: list[dict[str, str]], label: str) -> dict[str, str]:
        matches = [n for n in nodes if n.get('content-desc') == label or n.get('text') == label]
        assert matches, 'Missing UI target: ' + label
        return matches[0]

    def bounds(node: dict[str, str]) -> list[int]:
        return list(map(int, re.findall(r'\d+', node['bounds'])))

    def point(x: float, y: float) -> None:
        adb('shell', 'input', 'tap', str(round(x)), str(round(y)))

    def tap(node: dict[str, str]) -> None:
        l, t, r, b = bounds(node)
        point((l + r) / 2, (t + b) / 2)

    def capture(name: str) -> tuple[int, int]:
        data = subprocess.check_output(prefix + ['exec-out', 'screencap', '-p'], timeout=30)
        (args.output / (name + '.png')).write_bytes(data)
        return struct.unpack('>II', data[16:24])

    def metrics(nodes: list[dict[str, str]]) -> dict[str, object]:
        vp = bounds(find(nodes, '多排歌词区域'))
        focused = bounds(find(nodes, '而我们在音乐里相遇'))
        text = bounds(find(nodes, '听见风穿过远方'))
        assert abs((focused[1] + focused[3] - vp[1] - vp[3]) / 2) <= 6, (vp, focused)
        return {'viewport': vp, 'text_height': text[3] - text[1], 'focused': focused}

    auto = adb('shell', 'settings', 'get', 'system', 'accelerometer_rotation')
    rotation = adb('shell', 'settings', 'get', 'system', 'user_rotation')
    try:
        adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0')
        adb('shell', 'settings', 'put', 'system', 'user_rotation', '1')
        adb('shell', 'am', 'force-stop', package)
        adb('shell', 'am', 'start', '-W', '-n', target)
        for _ in range(5):
            if any(n.get('content-desc') == '专辑封面' for n in snapshot()):
                break
        else:
            raise AssertionError('Preview did not leave the Android launch screen')
        time.sleep(3.3)
        width, height = capture('initial')
        assert width > height
        density = int(re.findall(r'\d+', adb('shell', 'wm', 'density'))[-1]) / 160
        # The lock pins the layout while Android obtains its accessibility tree.
        # It is released before the actual physical blank-space tap under test.
        point(width * .70, height * .48)
        time.sleep(.2)
        point(width - 88 * density, 50 * density)
        nodes = snapshot()
        lock = find(nodes, '解锁界面')
        action('fixture-multiple')
        action('buffer')
        time.sleep(.8)

        def hide_and_measure(name: str) -> tuple[dict[str, object], dict[str, object]]:
            nodes = snapshot()
            shown = metrics(nodes)
            capture(name + '-shown')
            previous = bounds(find(nodes, '上一首'))
            play = bounds(find(nodes, '继续演示动画'))
            blank_x = (previous[2] + play[0]) / 2
            blank_y = (play[1] + play[3]) / 2
            point(blank_x, blank_y)
            assert find(snapshot(), '解锁界面'), 'Locked controls must stay visible'
            tap(find(nodes, '解锁界面'))
            adb('logcat', '-c')
            point(blank_x, blank_y)
            log = adb('logcat', '-d', '-s', 'PlayerChrome:D', '*:S')
            assert 'hidden=tap' in log, 'Blank tap did not hide controls: ' + log
            nodes = snapshot()
            assert not any(n.get('content-desc') == '上一首' for n in nodes)
            hidden = metrics(nodes)
            capture(name + '-hidden')
            assert hidden['viewport'][3] - hidden['viewport'][1] > shown['viewport'][3] - shown['viewport'][1]
            assert hidden['text_height'] > shown['text_height'] * 1.2, (shown, hidden)
            # One tap reveals the chrome and keeps the same record/lyric page.
            vp = hidden['viewport']
            point((vp[0] + vp[2]) / 2, (vp[1] + vp[3]) / 2)
            tap(lock)
            nodes = snapshot()
            find(nodes, '上一首')
            assert bool(any(n.get('content-desc') == '专辑封面' for n in nodes)) == (name == 'record-landscape')
            return shown, hidden

        results['fullscreen_landscape'] = hide_and_measure('fullscreen-landscape')
        nodes = snapshot()
        # Favorite and seeking must consume input, retaining the page and dock.
        tap(find(nodes, '取消喜欢'))
        nodes = snapshot()
        find(nodes, '喜欢')
        find(nodes, '多排歌词区域')
        tap(find(nodes, '喜欢'))
        nodes = snapshot()
        progress = bounds(find(nodes, '播放进度'))
        adb('shell', 'input', 'swipe', str(progress[0] + 10), str((progress[1] + progress[3]) // 2),
            str(progress[2] - 10), str((progress[1] + progress[3]) // 2), '350')
        find(snapshot(), '上一首')
        results['buttons_and_scrubbing_preserve_dock'] = True
        tap(find(snapshot(), '而我们在音乐里相遇'))
        time.sleep(.8)
        find(snapshot(), '专辑封面')
        results['record_landscape'] = hide_and_measure('record-landscape')

        # Let the timeout fire separately and verify a reveal does not switch pages.
        tap(lock)
        adb('logcat', '-c')
        time.sleep(3.3)
        assert 'hidden=timeout' in adb('logcat', '-d', '-s', 'PlayerChrome:D', '*:S')
        point(width * .70, height * .48)
        tap(lock)
        find(snapshot(), '专辑封面')
        results['automatic_hide_and_reveal_preserve_page'] = True

        # Fullscreen single-line mode also grows after controls are hidden.
        action('fixture-single')
        time.sleep(.8)
        nodes = snapshot()
        single_shown = bounds(find(nodes, '而我们在音乐里相遇'))
        capture('single-landscape-shown')
        prev = bounds(find(nodes, '上一首'))
        play = bounds(find(nodes, '继续演示动画'))
        tap(lock)
        point((prev[2] + play[0]) / 2, (play[1] + play[3]) / 2)
        single_hidden = bounds(find(snapshot(), '而我们在音乐里相遇'))
        capture('single-landscape-hidden')
        assert single_hidden[3] - single_hidden[1] > single_shown[3] - single_shown[1], (single_shown, single_hidden)
        results['single_line_adapts'] = True

        adb('shell', 'settings', 'put', 'system', 'user_rotation', '0')
        action('fixture-multiple')
        time.sleep(.8)
        nodes = snapshot()
        # Hidden state survives rotation; reveal once before recording the portrait dock.
        if not any(n.get('content-desc') == '上一首' for n in nodes):
            vp = bounds(find(nodes, '多排歌词区域'))
            point((vp[0] + vp[2]) / 2, (vp[1] + vp[3]) / 2)
        nodes = snapshot()
        results['portrait'] = metrics(nodes)
        width, height = capture('portrait-multiple')
        assert height > width
        for label in ('上一首', '下一首', '播放队列'):
            l, t, r, b = bounds(find(nodes, label))
            assert 0 <= l < r <= width and 0 <= t < b <= height
        action('fixture-next')
        time.sleep(.8)
        find(snapshot(), '把这一刻轻轻收藏')
        for _ in range(6):
            action('fixture-next')
        time.sleep(.8)
        long_line = '一行很长的歌词用来验证换行之后仍然能够平滑居中并且不会把相邻的文字挤到一起'
        nodes = snapshot()
        vp = bounds(find(nodes, '多排歌词区域'))
        line = bounds(find(nodes, long_line))
        assert vp[1] <= line[1] < line[3] <= vp[3], (vp, line)
        capture('portrait-long-line')
        action('fixture-end')
        time.sleep(.8)
        find(snapshot(), '晚安，明天见')
        capture('portrait-last-line')
        results['line_changes_and_track_end'] = True
        results['result'] = 'passed'
    finally:
        for key, value in [('accelerometer_rotation', auto), ('user_rotation', rotation)]:
            adb('shell', 'settings', 'delete' if value == 'null' else 'put', 'system', key, *([] if value == 'null' else [value]))
        (args.output / 'viewport-results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
