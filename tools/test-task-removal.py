"""Play an explicit local QA tone through the real RN/TrackPlayer path and swipe the task away.

Checks Android AudioTrack state, not physical speaker/Bluetooth output latency.
Requires an installed standalone Debug APK and an unlocked dedicated QA emulator.
"""
import argparse
import json
import math
from pathlib import Path
import re
import struct
import subprocess
import time
import wave
import xml.etree.ElementTree as ET


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--serial', default='emulator-5554')
    parser.add_argument('--output', type=Path, default=Path('build/task-removal-qa'))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    prefix = ['adb', '-s', args.serial]
    package = 'io.github.musicplus.player'

    def adb(*command):
        return subprocess.check_output(prefix + list(command), encoding='utf-8', errors='replace', timeout=40).strip()

    def snapshot():
        adb('shell', 'uiautomator', 'dump', '/sdcard/musicplus-exit.xml')
        xml = adb('shell', 'cat', '/sdcard/musicplus-exit.xml')
        return [n.attrib for n in ET.fromstring(xml).iter('node')]

    def players():
        return [line.strip() for line in adb('shell', 'dumpsys', 'audio').splitlines()
                if 'AudioPlaybackConfiguration' in line and f'u/pid:{uid}/' in line]

    def started():
        return any('state:started' in line for line in players())

    uid = re.search(r'uid:(\d+)', adb('shell', 'pm', 'list', 'packages', '-U', package)).group(1)
    tone = args.output / 'QA-tone.wav'
    with wave.open(str(tone), 'wb') as output:
        output.setparams((1, 2, 44100, 0, 'NONE', 'not compressed'))
        second = b''.join(struct.pack('<h', int(2600 * math.sin(i * 2 * math.pi * 440 / 44100))) for i in range(44100))
        for _ in range(120):
            output.writeframesraw(second)
    adb('push', str(tone), '/sdcard/Music/QA-tone.wav')
    adb('shell', 'input', 'keyevent', '224')
    adb('shell', 'wm', 'dismiss-keyguard')
    adb('shell', 'am', 'start', '-W', '-n', package + '/cn.toside.music.mobile.MainActivity',
        '-a', 'android.intent.action.VIEW', '-d', 'file:///sdcard/Music/QA-tone.wav', '-t', 'audio/wav')
    for _ in range(20):
        if started():
            break
        time.sleep(.3)
    else:
        raise AssertionError('QA tone did not start through the real playback service')
    adb('shell', 'input', 'keyevent', '3')
    time.sleep(.6)
    assert started(), 'Home must keep background playback running'
    adb('shell', 'input', 'keyevent', '223')
    time.sleep(.6)
    assert started(), 'Screen lock must keep background playback running'
    adb('shell', 'input', 'keyevent', '224')
    adb('shell', 'wm', 'dismiss-keyguard')
    time.sleep(.8)
    adb('shell', 'am', 'start', '-W', '-n', package + '/cn.toside.music.mobile.MainActivity')
    time.sleep(.8)
    adb('shell', 'input', 'keyevent', '3')
    time.sleep(.8)
    adb('shell', 'input', 'keyevent', '187')
    time.sleep(1)
    cards = [n for n in snapshot() if n.get('content-desc') == 'MUSIC++' and n.get('resource-id', '').endswith('/snapshot')]
    assert cards, 'MUSIC++ task card not found in Recents'
    left, top, right, bottom = map(int, re.findall(r'\d+', cards[0]['bounds']))
    x = str((left + right) // 2)
    assert started(), 'Recents must keep playback running until the card is removed'
    adb('logcat', '-c')
    began = time.perf_counter()
    adb('shell', 'input', 'swipe', x, str((top + bottom) // 2), x, '100', '250')
    samples = []
    for _ in range(30):
        current = players()
        elapsed = round((time.perf_counter() - began) * 1000)
        samples.append({'ms_from_swipe_start': elapsed, 'players': current})
        if not any('state:started' in line for line in current):
            break
        time.sleep(.08)
    assert not any('state:started' in line for line in samples[-1]['players']), 'Audio still active after task removal'
    assert samples[-1]['ms_from_swipe_start'] < 2000, samples
    remaining = snapshot()
    assert not any(n.get('content-desc') == 'MUSIC++' and n.get('resource-id', '').endswith('/snapshot') for n in remaining)
    time.sleep(3)
    assert not started(), 'Playback restarted after closing the task'
    log = adb('logcat', '-d', '-v', 'epoch', '-s', 'MusicPlusExit', 'RNTrackPlayer', 'AndroidRuntime')
    assert 'MusicPlusExit' in log, 'Native shutdown path was not exercised'
    (args.output / 'shutdown.log').write_text(log, encoding='utf-8')
    result = {'audio': 'generated local QA tone through actual RN TrackPlayer service',
              'home_continues': True, 'lock_continues': True, 'recents_continues': True,
              'task_removed': True, 'no_restart': True, 'samples': samples,
              'physical_output_latency_tested': False}
    (args.output / 'result.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
