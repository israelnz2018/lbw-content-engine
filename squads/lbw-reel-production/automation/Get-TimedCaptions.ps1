param(
  [Parameter(Mandatory = $true)][string]$VideoUrl,
  [Parameter(Mandatory = $true)][string]$OutputDirectory,
  [string]$Language = 'pt'
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command yt-dlp -ErrorAction SilentlyContinue)) {
  throw 'yt-dlp não está instalado. Não é permitido estimar os tempos das palavras.'
}

$destination = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $destination | Out-Null

$videoId = $null
if ($VideoUrl -match 'youtu\.be/([A-Za-z0-9_-]{11})') {
  $videoId = $Matches[1]
} elseif ($VideoUrl -match '[?&]v=([A-Za-z0-9_-]{11})') {
  $videoId = $Matches[1]
} else {
  $idOutput = @(& yt-dlp --get-id --skip-download $VideoUrl)
  if ($idOutput.Count -gt 0) { $videoId = ([string]$idOutput[0]).Trim() }
}
if ([string]::IsNullOrWhiteSpace($videoId)) {
  throw 'Não foi possível identificar o vídeo para obter a legenda temporizada.'
}

$cached = Join-Path $destination "$videoId.$Language.json3"
if (-not (Test-Path -LiteralPath $cached)) {
  & yt-dlp --skip-download --write-auto-subs --sub-format json3 --sub-langs $Language -o (Join-Path $destination '%(id)s.%(ext)s') $VideoUrl
  if ($LASTEXITCODE -ne 0) { throw 'Não foi possível baixar a legenda temporizada.' }
}

if (-not (Test-Path -LiteralPath $cached)) {
  $candidate = Get-ChildItem -LiteralPath $destination -Filter "$videoId*.json3" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($null -eq $candidate) { throw 'A legenda JSON3 não foi criada.' }
  $cached = $candidate.FullName
}

$json = Get-Content -Raw -Encoding UTF8 $cached | ConvertFrom-Json
$timedEvents = @($json.events | Where-Object { $null -ne $_.segs -and $_.segs.Count -gt 0 }).Count
if ($timedEvents -eq 0) { throw 'A legenda baixada não contém palavras temporizadas.' }

[pscustomobject]@{
  VideoId = $videoId
  CaptionPath = (Resolve-Path -LiteralPath $cached).Path
  TimedEvents = $timedEvents
  Language = $Language
}
