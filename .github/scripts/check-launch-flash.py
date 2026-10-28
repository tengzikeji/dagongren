#!/usr/bin/env python3
"""Detect a bright launch frame briefly replaced by a blank system window."""
from pathlib import Path
import json
import shutil
import subprocess
import sys


def detect_flash(values, threshold=4.0, window=10):
    # A meaningful bright-dark-bright reversal within half a second is a flash.
    for i in range(1, len(values)-1):
        earlier = max(values[max(0, i-window):i])
        later = max(values[i+1:min(len(values), i+window+1)])
        if earlier-values[i] >= threshold and later-values[i] >= threshold:
            return i, earlier-values[i], later-values[i]
    return None


def bar_flickers(values,expected=245):
    # The launcher may hand the status bar to the starting window once.
    # A monotonic light-to-blue handoff is not repeated flashing; reject a
    # reversal in either direction, then require the bar to settle on blue.
    return (len(values)<10 or any(x<=5 for x in values)
            or detect_flash(values,threshold=12) is not None
            or detect_flash([-x for x in values],threshold=12) is not None
            or any(abs(x-expected)>12 for x in values[-5:]))


def main():
    assert detect_flash([26, 26, 37, 26, 26, 37])
    assert detect_flash([26, 26, 27, 29, 32, 37]) is None
    assert not bar_flickers([188]*5+[245]*15)
    assert not bar_flickers([245]*20)
    assert not bar_flickers([29]*20,expected=29)
    assert bar_flickers([245]*5+[29]*3+[245]*12)
    assert bar_flickers([188]*3+[245]*3+[188]*3+[245]*11)
    if '--self-test' in sys.argv:
        print('Flash detector self-test passed')
        return
    video = Path(sys.argv[1]) if len(sys.argv)>1 else next(Path('android/app/build/reports').rglob('startup-transition.mp4'), None)
    ffmpeg = sys.argv[2] if len(sys.argv)>2 else shutil.which('ffmpeg')
    if not video or not video.is_file() or not ffmpeg:
        raise SystemExit('Startup video and ffmpeg are required for flash review')
    # Include the launcher search field and dock: sampling only the middle of
    # the wallpaper can mistake a dark blue patch for our solid startup window.
    p = subprocess.run([ffmpeg, '-v', 'error', '-i', str(video), '-t', '10.0', '-vf', 'fps=20,crop=iw*0.96:ih*0.87:iw*0.02:ih*0.045,scale=80:100,format=gray', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    size=80*100
    frames=[p.stdout[i:i+size] for i in range(0, len(p.stdout), size) if len(p.stdout[i:i+size])==size]
    stats=[]
    for frame in frames:
        mean=sum(frame)/size
        variance=sum((x-mean)**2 for x in frame)/size
        stats.append((mean, variance**.5))
    # Allow the launcher to remain visible until the process presents its solid blue window.
    anchor=next((i for i,(mean,sd) in enumerate(stats) if 22<=mean<=36 and sd<2.5),None)
    if anchor is None or len(stats)-anchor<10:
        raise SystemExit('Could not identify enough frames from the blue startup window')
    print('Solid startup window identified at',f'{anchor/20:.2f}s')
    values=[mean for mean,_ in stats[anchor:anchor+30]]
    flash=detect_flash(values)
    print('Startup window first 1.5s luminance:', ', '.join(f'{x:.1f}' for x in values))
    if any(x>=240 or x<=5 for x in values):
        raise SystemExit('A white or black screen appeared after the startup window')
    if flash:
        raise SystemExit(f'Launch brightness disappeared and returned around {(anchor+flash[0])/20:.2f}s (drops {flash[1]:.1f}, {flash[2]:.1f})')
    print('No bright-dark-bright flash detected during the native window handoff')
    # Sample the status-bar background between clock and system icons, beginning
    # at the same solid-blue window anchor, before the home color handoff.
    top = subprocess.run([ffmpeg, '-v', 'error', '-i', str(video), '-t', '10.0', '-vf', 'fps=20,crop=iw*0.24:ih*0.012:iw*0.38:ih*0.004,scale=24:4,format=gray', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True).stdout
    top_means=[sum(top[i:i+96])/96 for i in range(0,len(top),96) if len(top[i:i+96])==96][anchor:anchor+20]
    print('Startup status-bar first 1s luminance:', ', '.join(f'{x:.1f}' for x in top_means))
    background_error=bar_flickers(top_means)
    # Inspect foreground occupancy too: a stable blue background cannot prove
    # that the clock and system icons have remained visible.
    raw = subprocess.run([ffmpeg, '-v', 'error', '-i', str(video), '-t', '30.0', '-vf', 'fps=20,crop=iw:ih*0.032:0:0,scale=360:20,format=gray', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True).stdout
    from statistics import median
    import re
    progress=video.parent.parent/'device-progress.log'
    done=re.search(r'COMPLETED_SECOND=([0-9.]+)',progress.read_text(errors='replace')) if progress.exists() else None
    ready=re.search(r'FADE_READY_SECOND=([0-9.]+)',progress.read_text(errors='replace')) if progress.exists() else None
    playing=re.search(r'PLAYING_SECOND=([0-9.]+)',progress.read_text(errors='replace')) if progress.exists() else None
    end=int((float(done.group(1))+.15)*20) if done else anchor+30
    icon_frames=[raw[i:i+7200] for i in range(0,len(raw),7200) if len(raw[i:i+7200])==7200][anchor+1:end]
    backgrounds=[median(frame[y*360+x] for y in range(4,16) for x in range(150,210)) for frame in icon_frames]
    review={'anchor_second':anchor/20,'body':stats,'background':top_means,'icons':{}}
    failures=[]
    if not ready or not done:
        failures.append('Missing native/web fade synchronization markers')
    else:
        fading=[(i+anchor+1,bg) for i,bg in enumerate(backgrounds) if (i+anchor+1)/20>=float(ready.group(1))]
        review['bar_handoff']=fading
        first=next((i for i,bg in enumerate(backgrounds) if abs(bg-245)<=12),None)
        if first is None or not playing or (first+anchor+1)/20>float(playing.group(1))+.1:
            failures.append('Home status-bar scheme was not ready before the live launch scene')
        elif any(abs(bg-245)>12 for bg in backgrounds[first:]):
            failures.append('Native status-bar scheme changed during the launch handoff')
    for name,start,end in [('clock',0,120),('system',240,360)]:
        counts=[sum(abs(frame[y*360+x]-bg)>55 for y in range(20) for x in range(start,end)) for frame,bg in zip(icon_frames,backgrounds)]
        baseline=median(counts) if counts else 0
        review['icons'][name]={'baseline':baseline,'counts':counts}
        print('Startup '+name+' icon pixels:', ', '.join(map(str,counts)))
        if baseline<3 or detect_flash(counts,threshold=max(3,baseline*.55)):
            failures.append('Status-bar '+name+' icons disappeared and returned during startup')
    (video.parent/'startup-review.json').write_text(json.dumps(review,indent=2))
    if background_error:failures.insert(0,'Status-bar background changed unexpectedly before launch content')
    if failures:raise SystemExit('; '.join(failures))


if __name__ == '__main__':
    main()
