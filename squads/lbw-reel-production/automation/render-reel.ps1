param(
  [Parameter(Mandatory = $true)][string]$ConfigPath
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

function Convert-TimeToMilliseconds([string]$Value) {
  return [int64][Math]::Round(([TimeSpan]::Parse($Value)).TotalMilliseconds)
}

$configFile = Resolve-RequiredPath $ConfigPath 'Configuração'
$config = Get-Content -Raw -Encoding UTF8 $configFile | ConvertFrom-Json
$source = Resolve-RequiredPath $config.sourceVideo 'Vídeo-fonte'
$logo = Resolve-RequiredPath $config.logoPath 'Logo oficial'
$captions = Resolve-RequiredPath $config.captionsAss 'Legenda ASS'
$transcriptSource = Resolve-RequiredPath $config.transcriptSource 'Transcrição final preparada'

$clipStartMs = Convert-TimeToMilliseconds $config.clipStart
$clipEndMs = Convert-TimeToMilliseconds $config.clipEnd
$firstWordStartMs = Convert-TimeToMilliseconds $config.firstWordStart
$lastWordEndMs = Convert-TimeToMilliseconds $config.lastWordEnd
$nextWordStartMs = if ($null -ne $config.nextWordStart -and -not [string]::IsNullOrWhiteSpace([string]$config.nextWordStart)) { Convert-TimeToMilliseconds $config.nextWordStart } else { $null }
$minimumTailMs = if ($null -ne $config.minimumTailMs) { [int64]$config.minimumTailMs } else { 100 }
$maximumStartDifferenceMs = if ($null -ne $config.maximumStartDifferenceMs) { [int64]$config.maximumStartDifferenceMs } else { 100 }

if ($clipEndMs -le $clipStartMs) { throw 'O fim do corte deve ser posterior ao início.' }
if ([Math]::Abs($firstWordStartMs - $clipStartMs) -gt $maximumStartDifferenceMs) {
  throw "Início inseguro: o corte está mais de $maximumStartDifferenceMs ms distante da primeira palavra."
}
if ($clipEndMs -lt ($lastWordEndMs + $minimumTailMs)) {
  throw "Fim inseguro: faltam pelo menos $minimumTailMs ms depois da última palavra completa."
}
if ($null -ne $nextWordStartMs -and $clipEndMs -ge $nextWordStartMs) {
  throw 'Fim inseguro: o corte alcança a primeira palavra da frase seguinte.'
}

$durationSeconds = [Math]::Round(($clipEndMs - $clipStartMs) / 1000, 3)
$output = [IO.Path]::GetFullPath($config.outputPath)
$transcriptOutput = [IO.Path]::GetFullPath($config.transcriptOutputPath)
$workDir = [IO.Path]::GetFullPath($config.workDir)
$reelsRoot = [IO.Path]::GetFullPath($config.finalOutputDirectory)
if (-not (Test-Path -LiteralPath $reelsRoot)) { New-Item -ItemType Directory -Force -Path $reelsRoot | Out-Null }
if (-not $output.StartsWith($reelsRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Todos os Reels finais devem ser salvos em: $reelsRoot"
}
if (-not $transcriptOutput.StartsWith($reelsRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Todas as transcrições finais devem ser salvas em: $reelsRoot"
}
$outputFolder = Split-Path -Leaf (Split-Path -Parent $output)
$folderPattern = '^\d{4}-\d{2}-\d{2}__(Videos WB|Videos|Reels) - \d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$'
if ($outputFolder -notmatch $folderPattern) {
  throw "Nome da pasta inválido. Use: AAAA-MM-DD__Tipo - NN-tema"
}
if ((Split-Path -Parent $transcriptOutput) -ne (Split-Path -Parent $output)) {
  throw 'O Reel e a transcrição devem ficar na mesma pasta.'
}
if ((Test-Path -LiteralPath $output) -and -not [bool]$config.allowOverwrite) {
  throw "O Reel já existe e não pode ser sobrescrito: $output"
}
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $output), $workDir | Out-Null

$title1File = Join-Path $workDir 'title-line-1.txt'
$title2File = Join-Path $workDir 'title-line-2.txt'
$brandFile = Join-Path $workDir 'brand.txt'
$temporaryOutput = Join-Path $workDir 'render-validacao.mp4'
$instagramCover = Join-Path $workDir 'instagram-cover.jpg'
$coverPortrait = Join-Path $workDir 'cover-portrait.jpg'
$utf8 = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($title1File, [string]$config.titleLine1, $utf8)
[IO.File]::WriteAllText($title2File, [string]$config.titleLine2, $utf8)
[IO.File]::WriteAllText($brandFile, [string]$config.brandText, $utf8)

$layout = $config.layout
$captionFilterPath = Convert-ToFilterPath $captions
$title1FilterPath = Convert-ToFilterPath $title1File
$title2FilterPath = Convert-ToFilterPath $title2File
$brandFilterPath = Convert-ToFilterPath $brandFile

# NAO REMOVER o setpts=PTS-STARTPTS das duas ramificacoes abaixo.
# O filtro color gera o fundo a partir do tempo zero, mas a fonte entra com -ss antes
# do -i e so entrega o primeiro quadro alguns milissegundos depois. Sem o setpts, o
# overlay fica sem nada para sobrepor nesse intervalo e o primeiro quadro sai pelado:
# aparecem so o drawbox cinza e a barra azul sobre o fundo, sem slide e sem professor.
# Como o Reel roda em laco no Instagram, esse quadro pisca a cada volta.
# Sintoma no arquivo: o quadro em t=0 fica ~4x menor que os seguintes (197 KB contra 830 KB).
$filterGraph = @"
[0:v]setpts=PTS-STARTPTS,scale=$($layout.slideWidth):$($layout.slideHeight):flags=lanczos[top];
[0:v]setpts=PTS-STARTPTS,crop=$($layout.faceCropWidth):$($layout.faceCropHeight):$($layout.faceCropX):$($layout.faceCropY),scale=$($layout.faceOutputWidth):$($layout.faceOutputHeight):flags=lanczos[face];
color=c=0xF3F7FC:s=1080x1920:r=30[canvas];
[canvas][top]overlay=$($layout.slideX):$($layout.slideY)[tmp1];
[tmp1]drawbox=x=$($layout.coverX):y=$($layout.coverY):w=$($layout.coverWidth):h=$($layout.coverHeight):color=$($layout.coverColor):t=fill,drawbox=x=$($layout.slideX):y=$($layout.slideBarY):w=$($layout.slideWidth):h=$($layout.slideBarHeight):color=0x202D70:t=fill[tmpclean];
[tmpclean][face]overlay=$($layout.faceX):$($layout.faceY)[tmp2];
[tmp2]drawbox=x=0:y=0:w=1080:h=105:color=0x062B61:t=fill[head];
[1:v]scale=60:60[logo];
[head][logo]overlay=40:20[branded];
[branded]drawtext=fontfile='C\:/Windows/Fonts/arialbd.ttf':textfile='$brandFilterPath':fontcolor=white:fontsize=33:x=120:y=36:expansion=none,drawtext=fontfile='C\:/Windows/Fonts/arialbd.ttf':textfile='$title1FilterPath':fontcolor=0x0757FF:fontsize=70:x=(w-text_w)/2:y=135:expansion=none,drawtext=fontfile='C\:/Windows/Fonts/arialbd.ttf':textfile='$title2FilterPath':fontcolor=0x062B61:fontsize=70:x=(w-text_w)/2:y=215:expansion=none,subtitles='$captionFilterPath'[outv]
"@

ffmpeg -y -hide_banner -ss $config.clipStart -t $durationSeconds -i $source -loop 1 -i $logo `
  -filter_complex $filterGraph -map '[outv]' -map '0:a:0?' -t $durationSeconds `
  -af 'loudnorm=I=-16:TP=-1.5:LRA=11' -c:v libx264 -preset medium -crf 20 `
  -pix_fmt yuv420p -r 30 -c:a aac -ar 48000 -b:a 128k -movflags +faststart $temporaryOutput

if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $temporaryOutput)) {
  throw 'A renderização falhou.'
}

$probeText = ffprobe -v error -show_entries format=duration:stream=codec_name,codec_type,width,height,avg_frame_rate,sample_rate -of json $temporaryOutput
if ($LASTEXITCODE -ne 0) { throw 'A validação técnica falhou.' }
$probe = ($probeText -join [Environment]::NewLine) | ConvertFrom-Json
$videoStream = $probe.streams | Where-Object codec_type -eq 'video' | Select-Object -First 1
$audioStream = $probe.streams | Where-Object codec_type -eq 'audio' | Select-Object -First 1
if ($videoStream.width -ne 1080 -or $videoStream.height -ne 1920) { throw 'A saída não está em 1080 x 1920.' }
if ($null -eq $audioStream) { throw 'A saída foi gerada sem áudio.' }

$reviewTimes = @(2, [Math]::Floor($durationSeconds / 2), [Math]::Max(1, $durationSeconds - 0.5))
$reviewNames = @('qc-inicio.jpg', 'qc-meio.jpg', 'qc-fim.jpg')
for ($index = 0; $index -lt $reviewTimes.Count; $index++) {
  $framePath = Join-Path $workDir $reviewNames[$index]
  ffmpeg -y -hide_banner -loglevel error -ss $reviewTimes[$index] -i $temporaryOutput -frames:v 1 -update 1 $framePath
  if ($LASTEXITCODE -ne 0) { throw "Falha ao extrair $($reviewNames[$index])." }
}

# A capa e uma arte dedicada. Somente o retrato vem de um quadro revisado do Reel.
# Isso evita que slides, legendas ou transicoes virem a miniatura no Instagram.
if ($null -eq $config.cover -or $config.cover.mode -ne 'dedicated') {
  throw 'Capa dedicada obrigatoria: configure cover.mode como dedicated.'
}
$portraitTimeSeconds = if ($null -ne $config.cover.portraitTimeSeconds) { [double]$config.cover.portraitTimeSeconds } else { 2.0 }
$portraitLimitSeconds = [Math]::Max(1.0, [Math]::Round($durationSeconds / 3, 3))
if ($portraitTimeSeconds -lt 0.5 -or $portraitTimeSeconds -gt $portraitLimitSeconds) {
  throw "cover.portraitTimeSeconds deve ficar entre 0,5 s e o primeiro terco do Reel ($portraitLimitSeconds s)."
}
ffmpeg -y -hide_banner -loglevel error -ss $portraitTimeSeconds -i $temporaryOutput `
  -vf "crop=$($layout.faceOutputWidth):$($layout.faceOutputHeight):$($layout.faceX):$($layout.faceY)" `
  -frames:v 1 -update 1 -q:v 2 $coverPortrait
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $coverPortrait)) {
  throw 'Falha ao extrair o retrato para a capa.'
}
$coverRenderer = Join-Path $PSScriptRoot 'render-reel-cover.mjs'
node $coverRenderer --config $configFile --portrait $coverPortrait --output $instagramCover
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $instagramCover)) {
  throw 'Falha ao gerar a capa dedicada do Instagram.'
}

[IO.File]::WriteAllText((Join-Path $workDir 'ffprobe.json'), ($probeText -join [Environment]::NewLine), $utf8)
Move-Item -LiteralPath $temporaryOutput -Destination $output -Force
if (-not $transcriptSource.Equals($transcriptOutput, [StringComparison]::OrdinalIgnoreCase)) {
  Copy-Item -LiteralPath $transcriptSource -Destination $transcriptOutput -Force
}

# A capa vai junto da entrega: o publish-reel.js exige o arquivo em --cover,
# entao ela nao pode ficar so na pasta tecnica.
$coverDelivered = Join-Path (Split-Path -Parent $output) 'capa.jpg'
Copy-Item -LiteralPath $instagramCover -Destination $coverDelivered -Force

[pscustomobject]@{
  OutputPath = $output
  TranscriptPath = $transcriptOutput
  DurationSeconds = $durationSeconds
  TailAfterLastWordMs = $clipEndMs - $lastWordEndMs
  GapBeforeNextWordMs = if ($null -ne $nextWordStartMs) { $nextWordStartMs - $clipEndMs } else { $null }
  Resolution = '1080x1920'
  VideoCodec = $videoStream.codec_name
  AudioCodec = $audioStream.codec_name
  CoverPath = $coverDelivered
  CoverMode = 'dedicated'
  CoverCourse = $config.cover.courseKey
  CoverPortraitTimeSeconds = $portraitTimeSeconds
}
