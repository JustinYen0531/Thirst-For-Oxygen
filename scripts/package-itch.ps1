param(
  [string]$PackageName = 'Thirst-for-Oxygen-itch.io'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$outputRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'output'))
$stageDirectory = [System.IO.Path]::GetFullPath((Join-Path $outputRoot 'itch-stage'))
$zipPath = [System.IO.Path]::GetFullPath((Join-Path $outputRoot "$PackageName.zip"))
$hashPath = [System.IO.Path]::GetFullPath((Join-Path $outputRoot "$PackageName.sha256.txt"))
$outputPrefix = $outputRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar

if (-not $stageDirectory.StartsWith($outputPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Unsafe staging path: $stageDirectory"
}
if ([System.IO.Path]::GetDirectoryName($zipPath) -ne $outputRoot) {
  throw "Unsafe ZIP path: $zipPath"
}

if (Test-Path -LiteralPath $stageDirectory) {
  Remove-Item -LiteralPath $stageDirectory -Recurse -Force
}
[System.IO.Directory]::CreateDirectory($outputRoot) | Out-Null
[System.IO.File]::Delete($zipPath)
[System.IO.File]::Delete($hashPath)

Push-Location $projectRoot
try {
  & npm.cmd run build -- --outDir $stageDirectory --emptyOutDir
  if ($LASTEXITCODE -ne 0) {
    throw "Vite build failed with exit code $LASTEXITCODE"
  }
}
finally {
  Pop-Location
}

# Keep the authored source videos untouched, but make the upload copy small
# enough for itch.io. The story player is muted, so packaged MP4 audio tracks
# are unnecessary; CRF 30 retains the visuals while cutting upload weight.
$legacyHomeVideos = @(
  'assets/home/abyss-seafloor-ping-pong-067.mp4',
  'assets/home/abyss-seafloor-ping-pong-v2-067.mp4'
)
foreach ($relativePath in $legacyHomeVideos) {
  [System.IO.File]::Delete((Join-Path $stageDirectory $relativePath))
}

$packageVideos = @(
  Get-ChildItem -LiteralPath (Join-Path $stageDirectory 'assets/story') -Recurse -File -Filter '*.mp4'
  Get-Item -LiteralPath (Join-Path $stageDirectory 'assets/home/start-game-descent-loading.mp4')
  Get-Item -LiteralPath (Join-Path $stageDirectory 'assets/home/abyss-seafloor-ping-pong-v3-audio-067.mp4')
)
foreach ($video in $packageVideos) {
  $compressedPath = "$($video.FullName).package.mp4"
  & ffmpeg -hide_banner -loglevel error -y -i $video.FullName -map 0:v:0 -c:v libx264 -preset veryfast -crf 30 -pix_fmt yuv420p -an -movflags +faststart $compressedPath
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $compressedPath)) {
    throw "Failed to compress packaged video: $($video.FullName)"
  }
  [System.IO.File]::Delete($video.FullName)
  [System.IO.File]::Move($compressedPath, $video.FullName)
}

$sourceEditorPath = Join-Path $stageDirectory 'index.html'
$editorPath = Join-Path $stageDirectory 'editor.html'
$homePath = Join-Path $stageDirectory 'home.html'
if (-not (Test-Path -LiteralPath $sourceEditorPath) -or -not (Test-Path -LiteralPath $homePath)) {
  throw 'Vite output must contain both index.html and home.html.'
}

Move-Item -LiteralPath $sourceEditorPath -Destination $editorPath
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$homeHtml = [System.IO.File]::ReadAllText($homePath, [System.Text.Encoding]::UTF8)
$itchHomeHtml = $homeHtml.Replace('href="./index.html"', 'href="./editor.html"')
if ($itchHomeHtml -eq $homeHtml) {
  throw 'Could not remap the Map Editor link from index.html to editor.html.'
}
[System.IO.File]::WriteAllText($homePath, $itchHomeHtml, $utf8NoBom)
[System.IO.File]::WriteAllText($sourceEditorPath, $itchHomeHtml, $utf8NoBom)

$entryHtml = [System.IO.File]::ReadAllText($sourceEditorPath, [System.Text.Encoding]::UTF8)
$editorHtml = [System.IO.File]::ReadAllText($editorPath, [System.Text.Encoding]::UTF8)
if (-not $entryHtml.Contains('id="home-intro"')) {
  throw 'ZIP root index.html is not the authored helmet title screen.'
}
if (-not $editorHtml.Contains('id="map-canvas"')) {
  throw 'editor.html does not contain the map editor.'
}

$forbiddenPathLiterals = @(
  'href="/',
  "href='/",
  'src="/',
  "src='/",
  'url(/',
  '"/assets/',
  "'/assets/",
  '"/maps/',
  "'/maps/",
  '"/home.html',
  "'/home.html",
  '"/play.html',
  "'/play.html",
  '"/sandbox.html',
  "'/sandbox.html",
  '"/tutorial.html',
  "'/tutorial.html"
)
$textFiles = Get-ChildItem -LiteralPath $stageDirectory -Recurse -File | Where-Object {
  $_.Extension -in @('.html', '.js', '.css')
}
foreach ($file in $textFiles) {
  $text = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
  foreach ($literal in $forbiddenPathLiterals) {
    if ($text.Contains($literal)) {
      $relativeFile = $file.FullName.Substring($stageDirectory.Length + 1)
      throw "Unsafe packaged path '$literal' remains in $relativeFile"
    }
  }
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$stagePrefix = $stageDirectory.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
$stageFiles = @(Get-ChildItem -LiteralPath $stageDirectory -Recurse -File | Sort-Object FullName)
$expectedEntries = @($stageFiles | ForEach-Object {
  $_.FullName.Substring($stagePrefix.Length).Replace('\', '/')
})

$alreadyCompressedExtensions = @('.aiff', '.gif', '.jpeg', '.jpg', '.mp3', '.mp4', '.ogg', '.png', '.wav', '.webp')
$zipStream = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::CreateNew)
$archive = New-Object System.IO.Compression.ZipArchive(
  $zipStream,
  [System.IO.Compression.ZipArchiveMode]::Create,
  $false,
  [System.Text.Encoding]::UTF8
)
try {
  foreach ($file in $stageFiles) {
    $entryName = $file.FullName.Substring($stagePrefix.Length).Replace('\', '/')
    if ($entryName.Contains('\') -or $entryName.StartsWith('/') -or $entryName.Contains('../')) {
      throw "Unsafe ZIP entry name: $entryName"
    }
    $compression = if ($alreadyCompressedExtensions -contains $file.Extension.ToLowerInvariant()) {
      [System.IO.Compression.CompressionLevel]::NoCompression
    }
    else {
      [System.IO.Compression.CompressionLevel]::Optimal
    }
    $entry = $archive.CreateEntry($entryName, $compression)
    $entry.LastWriteTime = [System.DateTimeOffset]$file.LastWriteTime
    $inputStream = [System.IO.File]::OpenRead($file.FullName)
    $entryStream = $entry.Open()
    try {
      $inputStream.CopyTo($entryStream)
    }
    finally {
      $entryStream.Dispose()
      $inputStream.Dispose()
    }
  }
}
finally {
  $archive.Dispose()
  $zipStream.Dispose()
}

$readArchive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $actualEntries = @($readArchive.Entries | Where-Object { -not $_.FullName.EndsWith('/') } | ForEach-Object { $_.FullName })
  if ($actualEntries -notcontains 'index.html') {
    throw 'ZIP does not contain index.html at its root.'
  }
  $unsafeEntries = @($actualEntries | Where-Object {
    $_.Contains('\') -or $_.StartsWith('/') -or $_.Contains('../')
  })
  if ($unsafeEntries.Count -gt 0) {
    throw "ZIP contains unsafe entry names: $($unsafeEntries -join ', ')"
  }
  $duplicates = @($actualEntries | Group-Object { $_.ToLowerInvariant() } | Where-Object Count -gt 1)
  if ($duplicates.Count -gt 0) {
    throw "ZIP contains case-insensitive duplicate entries: $($duplicates.Name -join ', ')"
  }
  $entryDiff = @(Compare-Object -ReferenceObject $expectedEntries -DifferenceObject $actualEntries)
  if ($entryDiff.Count -gt 0) {
    throw 'ZIP entry list does not exactly match the staging directory.'
  }
  $unicodeEntries = @($actualEntries | Where-Object { $_ -match '[^\u0000-\u007F]' })
  if ($unicodeEntries.Count -eq 0) {
    throw 'Expected at least one Unicode filename in the package validation set.'
  }
}
finally {
  $readArchive.Dispose()
}

$hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash
[System.IO.File]::WriteAllText(
  $hashPath,
  "$hash  $([System.IO.Path]::GetFileName($zipPath))`r`n",
  $utf8NoBom
)
$zipInfo = Get-Item -LiteralPath $zipPath
if ($zipInfo.Length -ge 500000000) {
  throw "itch.io ZIP must stay below 500 MB; actual bytes: $($zipInfo.Length)"
}

Write-Host "ITCH_PACKAGE=$zipPath"
Write-Host "ITCH_SHA256=$hash"
Write-Host "ITCH_ENTRIES=$($expectedEntries.Count)"
Write-Host "ITCH_UNICODE_ENTRIES=$($unicodeEntries.Count)"
Write-Host "ITCH_BYTES=$($zipInfo.Length)"
