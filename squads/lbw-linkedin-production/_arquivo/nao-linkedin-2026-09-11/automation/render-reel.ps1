param(
  [Parameter(Mandatory = $true)]
  [string]$ConfigPath
)

$ErrorActionPreference = 'Stop'

function Resolve-RequiredPath([string]$PathValue, [string]$Label) {
  if ([string]::IsNullOrWhiteSpace($PathValue) -or -not (Test-Path -LiteralPath $PathValue)) {
    throw "$Label não encontrado: $PathValue"
  }
  return (Resolve-Path -LiteralPath $PathValue).Path
}

function Convert-ToFilterPath([string]$PathValue) {
  return $PathValue.Replace('\', '/').Replace(':', '\:').Replace("'", "\'")
}

$configFile = Resolve-RequiredPath $ConfigPath 'Configuração'
$config = Get-Content -Raw -Encoding UTF8 $configFile | ConvertFrom-Json
$source = Resolve-RequiredPath $config.sourceVideo 'Vídeo-fonte'
$logo = Resolve-RequiredPath $config.logoPath 'Logo oficial'
$captions = Resolve-RequiredPath $config.captionsAss 'Legenda ASS'

$outputRoot = [IO.Path]::GetFullPath($config.outputRoot)
$finalDir = Join-Path $outputRoot 'FINAL'
$technicalDir = Join-Path $outputRoot '_tecnico'
New-Item -ItemType Directory -Force -Path $finalDir, $technicalDir | Out-Null

$title1File = Join-Path $technicalDir 'title-line-1.txt'
$title2File = Join-Path $technicalDir 'title-line-2.txt'
$brandFile = Join-Path $technicalDir 'brand.txt'
$utf8 = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($title1File, [string]$config.titleLine1, $utf8)
[IO.File]::WriteAllText($title2File, [string]$config.titleLine2, $utf8)
[IO.File]::WriteAllText($brandFile, [string]$config.brandText, $utf8)

$layout = $config.layout
$captionFilterPath = Convert-ToFilterPath $captions
$title1FilterPath = Convert-ToFilterPath $title1File
$title2FilterPath = Convert-ToFilterPath $title2File
$brandFilterPath = Convert-ToFilterPath $brandFile
$output = Join-Path $finalDir $config.outputName

$filterGraph = @"
[0:v]scale=$($layout.slideWidth):$($layout.slideHeight):flags=lanczos[top];
[0:v]crop=$($layout.faceCropWidth):$($layout.faceCropHeight):$($layout.faceCropX):$($layout.faceCropY),scale=$($layout.faceSize):$($layout.faceSize):flags=lanczos[face];
color=c=0xF3F7FC:s=1080x1920:r=30[canvas];
[canvas][top]overlay=$($layout.slideX):$($layout.slideY)[tmp1];
[tmp1]drawbox=x=$($layout.coverX):y=$($layout.coverY):w=$($layout.coverWidth):h=$($layout.coverHeight):color=$($layout.coverColor):t=fill,drawbox=x=$($layout.slideX):y=$($layout.slideBarY):w=$($layout.slideWidth):h=$($layout.slideBarHeight):color=0x202D70:t=fill[tmpclean];
[tmpclean][face]overlay=$($layout.faceX):$($layout.faceY)[tmp2];
[tmp2]drawbox=x=0:y=0:w=1080:h=105:color=0x062B61:t=fill[head];
[1:v]scale=150:60[logo];
[head][logo]overlay=40:20[branded];
[branded]drawtext=fontfile='C\:/Windows/Fonts/arialbd.ttf':textfile='$brandFilterPath':fontcolor=white:fontsize=33:x=210:y=36:expansion=none,drawtext=fontfile='C\:/Windows/Fonts/arialbd.ttf':textfile='$title1FilterPath':fontcolor=0x0757FF:fontsize=70:x=(w-text_w)/2:y=135:expansion=none,drawtext=fontfile='C\:/Windows/Fonts/arialbd.ttf':textfile='$title2FilterPath':fontcolor=0x062B61:fontsize=70:x=(w-text_w)/2:y=215:expansion=none,drawtext=fontfile='C\:/Windows/Fonts/arialbd.ttf':textfile='$brandFilterPath':fontcolor=0x062B61:fontsize=29:x=(w-text_w)/2:y=$($layout.footerY):expansion=none,subtitles='$captionFilterPath'[outv]
"@

ffmpeg -y -hide_banner -ss $config.clipStart -t $config.duration -i $source -loop 1 -i $logo `
  -filter_complex $filterGraph -map '[outv]' -map '0:a:0?' -t $config.duration `
  -af 'loudnorm=I=-16:TP=-1.5:LRA=11' -c:v libx264 -preset medium -crf 20 `
  -pix_fmt yuv420p -r 30 -c:a aac -ar 48000 -b:a 128k -movflags +faststart $output

if ($LASTEXITCODE -ne 0) {
  throw "FFmpeg terminou com código $LASTEXITCODE"
}

$reviewTimes = @(2, [Math]::Floor([double]$config.duration / 2), [Math]::Max(1, [double]$config.duration - 1))
$reviewNames = @('qc-inicio.jpg', 'qc-meio.jpg', 'qc-fim.jpg')
for ($index = 0; $index -lt $reviewTimes.Count; $index++) {
  $framePath = Join-Path $technicalDir $reviewNames[$index]
  ffmpeg -y -hide_banner -loglevel error -ss $reviewTimes[$index] -i $output -frames:v 1 -update 1 $framePath
  if ($LASTEXITCODE -ne 0) { throw "Falha ao extrair $($reviewNames[$index])" }
}

$probe = ffprobe -v error -show_entries format=duration:stream=codec_name,codec_type,width,height,avg_frame_rate,sample_rate,bit_rate -of json $output
[IO.File]::WriteAllText((Join-Path $technicalDir 'ffprobe.json'), ($probe -join [Environment]::NewLine), $utf8)

Get-Item $output | Select-Object FullName, Length, LastWriteTime
