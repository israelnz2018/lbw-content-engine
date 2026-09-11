param(
  [Parameter(Mandatory = $true)][string]$Json3Path,
  [Parameter(Mandatory = $true)][string]$ClipStart,
  [Parameter(Mandatory = $true)][string]$ClipEnd,
  [Parameter(Mandatory = $true)][string]$OutputPath,
  [string]$LastWord = '',
  [int]$MaxWords = 9,
  [int]$MaxCharacters = 52
)

$ErrorActionPreference = 'Stop'

function Convert-TimeToMilliseconds([string]$Value) {
  return [int64][Math]::Round(([TimeSpan]::Parse($Value)).TotalMilliseconds)
}

function Repair-Utf8Mojibake([string]$Text) {
  # Alguns JSON3 antigos foram gravados com UTF-8 interpretado como ANSI.
  # Repara somente textos que apresentam sinais claros desse problema.
  for ($attempt = 0; $attempt -lt 2 -and ($Text.Contains([char]0xC3) -or $Text.Contains([char]0xC2) -or $Text.Contains([char]0xFFFD)); $attempt++) {
    try {
      $Text = [Text.Encoding]::UTF8.GetString([Text.Encoding]::GetEncoding(28591).GetBytes($Text))
    } catch {
      break
    }
  }
  return $Text
}

function Format-AssTime([int64]$Milliseconds) {
  if ($Milliseconds -lt 0) { $Milliseconds = 0 }
  $span = [TimeSpan]::FromMilliseconds($Milliseconds)
  return ('{0}:{1:00}:{2:00}.{3:00}' -f [int]$span.TotalHours, $span.Minutes, $span.Seconds, [int]($span.Milliseconds / 10))
}

$technicalTermsPath = Join-Path $PSScriptRoot '..\pipeline\data\technical-terms.json'
if (-not (Test-Path -LiteralPath $technicalTermsPath)) { throw "Dicionário de termos técnicos não encontrado: $technicalTermsPath" }
$technicalTerms = Get-Content -Raw -Encoding UTF8 $technicalTermsPath | ConvertFrom-Json
$technicalReplacements = @(
  foreach ($term in $technicalTerms.terms) {
    foreach ($variant in $term.variants) {
      [pscustomobject]@{ Variant = [string]$variant; Canonical = [string]$term.canonical }
    }
  }
) | Sort-Object { $_.Variant.Length } -Descending

function Normalize-TechnicalTerms([string]$Text) {
  foreach ($replacement in $technicalReplacements) {
    $pattern = '(?i)(?<!\p{L})' + [regex]::Escape($replacement.Variant) + '(?!\p{L})'
    $Text = [regex]::Replace($Text, $pattern, $replacement.Canonical)
  }
  return $Text
}

$jsonFile = (Resolve-Path -LiteralPath $Json3Path).Path
$clipStartMs = Convert-TimeToMilliseconds $ClipStart
$clipEndMs = Convert-TimeToMilliseconds $ClipEnd
if ($clipEndMs -le $clipStartMs) { throw 'ClipEnd deve ser posterior a ClipStart.' }

$json = Get-Content -Raw -Encoding UTF8 $jsonFile | ConvertFrom-Json
$words = [System.Collections.Generic.List[object]]::new()
$lastWordNormalized = $LastWord.TrimEnd(',', '.', ';', '?', '!')

foreach ($event in $json.events) {
  if ($null -eq $event.segs -or $event.segs.Count -eq 0) { continue }
  foreach ($segment in $event.segs) {
    $text = Repair-Utf8Mojibake (([string]$segment.utf8).Trim())
    # Normaliza os nomes técnicos antes de separar as palavras e criar o karaoke.
    # Assim, erros recorrentes do reconhecimento automático não chegam à legenda final.
    $text = Normalize-TechnicalTerms $text
    # O dicionário controlado corrige somente nomes técnicos. O áudio original permanece intacto.
    if ([string]::IsNullOrWhiteSpace($text)) { continue }
    $offset = 0
    if ($null -ne $segment.tOffsetMs) { $offset = [int64]$segment.tOffsetMs }
    $absoluteMs = [int64]$event.tStartMs + $offset
    $tokens = @($text -split '\s+' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    for ($tokenIndex = 0; $tokenIndex -lt $tokens.Count; $tokenIndex++) {
      $token = $tokens[$tokenIndex]
      if ([string]::IsNullOrWhiteSpace($token)) { continue }
      # Algumas variações representam uma expressão inteira em uma única palavra.
      # O sublinhado mantém essa expressão em um único instante de sincronismo.
      $token = $token.Replace('_', ' ')
      # JSON3 fornece a duração do bloco de fala, não o tempo de cada palavra.
      # Distribuímos as palavras dentro desse bloco e permitimos limitar o trecho
      # à última palavra editorial escolhida, evitando texto posterior no Reel.
      $tokenStartMs = $absoluteMs + [int64][Math]::Round(($event.dDurationMs * $tokenIndex) / [Math]::Max(1, $tokens.Count))
      if ($tokenStartMs -ge $clipStartMs -and $tokenStartMs -lt $clipEndMs) {
        $words.Add([pscustomobject]@{ Text = $token; StartMs = $tokenStartMs })
        if (-not [string]::IsNullOrWhiteSpace($lastWordNormalized) -and $token.TrimEnd(',','.',';','?','!') -ieq $lastWordNormalized) {
          break
        }
      }
    }
  }
}

$words = @($words | Sort-Object StartMs | Group-Object { "{0}|{1}" -f $_.StartMs, $_.Text } | ForEach-Object { $_.Group[0] })
if ($words.Count -eq 0) { throw 'Nenhuma palavra temporizada foi encontrada dentro do corte.' }
if (-not [string]::IsNullOrWhiteSpace($LastWord)) {
  $lastIndex = -1
  for ($i = 0; $i -lt $words.Count; $i++) {
    if ($words[$i].Text.TrimEnd(',','.',';','?','!') -ieq $lastWordNormalized) { $lastIndex = $i; break }
  }
  if ($lastIndex -lt 0) { throw "A última palavra editorial não foi encontrada: $LastWord" }
  $words = @($words[0..$lastIndex])
}

$blocks = [System.Collections.Generic.List[object]]::new()
$current = [System.Collections.Generic.List[object]]::new()
$characters = 0

foreach ($word in $words) {
  $gap = if ($current.Count -gt 0) { $word.StartMs - $current[$current.Count - 1].StartMs } else { 0 }
  $projected = $characters + $(if ($current.Count -gt 0) { 1 } else { 0 }) + $word.Text.Length
  if ($current.Count -gt 0 -and ($current.Count -ge $MaxWords -or $projected -gt $MaxCharacters -or $gap -gt 850)) {
    $blocks.Add(@($current))
    $current = [System.Collections.Generic.List[object]]::new()
    $characters = 0
  }
  $current.Add($word)
  $characters += $(if ($characters -gt 0) { 1 } else { 0 }) + $word.Text.Length
}
if ($current.Count -gt 0) { $blocks.Add(@($current)) }

$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add('[Script Info]')
$lines.Add('ScriptType: v4.00+')
$lines.Add('PlayResX: 1080')
$lines.Add('PlayResY: 1920')
$lines.Add('ScaledBorderAndShadow: yes')
$lines.Add('')
$lines.Add('[V4+ Styles]')
$lines.Add('Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding')
$lines.Add('Style: LBW,Arial,49,&H0000D7FF,&H00FFFFFF,&H00612B06,&H00000000,-1,0,0,0,100,100,0,0,1,3,2,2,55,55,250,1')
$lines.Add('')
$lines.Add('[Events]')
$lines.Add('Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text')

for ($blockIndex = 0; $blockIndex -lt $blocks.Count; $blockIndex++) {
  $block = @($blocks[$blockIndex])
  $eventStartAbs = [int64]$block[0].StartMs
  $nextBlockStartAbs = if ($blockIndex + 1 -lt $blocks.Count) { [int64]$blocks[$blockIndex + 1][0].StartMs } else { $clipEndMs }
  $eventEndAbs = [Math]::Min($clipEndMs, [Math]::Max($eventStartAbs + 300, $nextBlockStartAbs - 20))

  $plainLength = (($block | ForEach-Object { $_.Text }) -join ' ').Length
  $half = [Math]::Ceiling($plainLength / 2)
  $used = 0
  $breakInserted = $false
  $assText = ''

  for ($wordIndex = 0; $wordIndex -lt $block.Count; $wordIndex++) {
    $word = $block[$wordIndex]
    $nextStart = if ($wordIndex + 1 -lt $block.Count) { [int64]$block[$wordIndex + 1].StartMs } else { $eventEndAbs }
    $centiseconds = [Math]::Max(1, [int][Math]::Round(($nextStart - [int64]$word.StartMs) / 10))
    if ($wordIndex -gt 0) {
      if (-not $breakInserted -and $used -ge $half) {
        $assText += '\N'
        $breakInserted = $true
      } else {
        $assText += ' '
      }
    }
    $assText += "{\k$centiseconds}$($word.Text.ToUpperInvariant())"
    $used += $word.Text.Length + 1
  }

  $eventStart = Format-AssTime ($eventStartAbs - $clipStartMs)
  $eventEnd = Format-AssTime ($eventEndAbs - $clipStartMs)
  $lines.Add("Dialogue: 0,$eventStart,$eventEnd,LBW,,0,0,0,,$assText")
}

# Normalização final dos nomes, preservando as tags de sincronismo karaoke.
$lines = @($lines | ForEach-Object {
  $_ -replace '(?i)(LEAN) (\{\\k\d+\})SIGMA', '$1 SIX $2SIGMA' `
     -replace '(?i)(\})SE (\{\\k\d+\})SIGMA', '$1SIX $2SIGMA'
})

$leakedTechnicalError = @($lines | Where-Object {
  $_ -match '(?i)\b(?:lincig|linsic|linic|linico|inc)\b.*\b(?:sigma|signa)\b' -or
  $_ -match '(?i)\b(?:seis|se)\b.*\bsigma\b' -or
  $_ -match '(?i)\b(?:whitebuilt|yellowbuilt|greenbuilt|blackbuilt)\b'
})
if ($leakedTechnicalError.Count -gt 0) {
  throw 'A legenda ainda contém uma variação incorreta de termo técnico. Revise o dicionário technical-terms.json.'
}

$destination = [IO.Path]::GetFullPath($OutputPath)
$parent = Split-Path -Parent $destination
New-Item -ItemType Directory -Force -Path $parent | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllLines($destination, $lines, $utf8)

[pscustomobject]@{
  OutputPath = $destination
  WordCount = $words.Count
  BlockCount = $blocks.Count
  FirstWord = $words[0].Text
  FirstWordStart = Format-AssTime ($words[0].StartMs - $clipStartMs)
  LastWord = $words[$words.Count - 1].Text
  LastWordStart = Format-AssTime ($words[$words.Count - 1].StartMs - $clipStartMs)
  ClipDurationMs = $clipEndMs - $clipStartMs
}
