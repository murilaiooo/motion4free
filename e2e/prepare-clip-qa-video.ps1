# Locally synthesize a minimum-duration speech sample for Brave E2E validation.
# Do not commit or distribute Microsoft SAPI voice output; test artifacts are gitignored.
$ErrorActionPreference = 'Stop'
$fixtureDir = Join-Path $PSScriptRoot 'fixtures'
New-Item -ItemType Directory -Path $fixtureDir -Force | Out-Null
$wav = Join-Path $fixtureDir 'qa-voice-local.wav'
$mp4 = Join-Path $fixtureDir 'long-tts-122s-local.mp4'
Add-Type -AssemblyName System.Speech
$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $voice.Rate = 1
  $voice.SetOutputToWaveFile($wav)
  $voice.Speak('Welcome to the Motion for Free editing demonstration. Today we have a short story with a clear beginning, middle and conclusion. First, imagine that your team has a difficult problem and you need to explain it in simple words. The challenge is that every short video must contain its own context. Next, you need to show what changed and why that change makes a difference. The key result is that each video should be clear enough for a person watching it for the first time. Finally, always check the beginning and the ending before exporting your clip.')
} finally {
  $voice.Dispose()
}
& ffmpeg -hide_banner -loglevel error -y -f lavfi -i 'testsrc2=size=320x180:rate=5' -i $wav -filter_complex '[1:a]apad=whole_dur=122[a]' -map 0:v -map '[a]' -t 122 -c:v libx264 -pix_fmt yuv420p -preset ultrafast -crf 35 -c:a aac -b:a 48k -movflags +faststart $mp4
if ($LASTEXITCODE -ne 0) { throw "FFmpeg failed (exit $LASTEXITCODE)" }
& ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 $mp4
if ($LASTEXITCODE -ne 0) { throw "FFprobe failed (exit $LASTEXITCODE)" }
Write-Host "Local speech source ready: $mp4"
$repeat = Join-Path $fixtureDir 'long-tts-repeat-122s-local.mp4'
& ffmpeg -hide_banner -loglevel error -y -f lavfi -i 'testsrc2=size=320x180:rate=5' -stream_loop 3 -i $wav -t 122 -c:v libx264 -pix_fmt yuv420p -preset ultrafast -crf 35 -c:a aac -b:a 48k -movflags +faststart $repeat
if ($LASTEXITCODE -ne 0) { throw "FFmpeg repeat failed (exit $LASTEXITCODE)" }
& ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 $repeat
if ($LASTEXITCODE -ne 0) { throw "FFprobe repeat failed (exit $LASTEXITCODE)" }
Write-Host "Repeated speech fixture for ?asr=clips: $repeat"
