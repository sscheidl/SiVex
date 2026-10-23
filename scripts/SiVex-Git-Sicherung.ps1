# SiVex: Git-Vollbackup in eine Kopie der vorhandenen ZIP einbetten.
# Windows PowerShell 5.1 oder PowerShell 7, installiertes Git erforderlich.
# Das Quellarchiv und das GitHub-Repository werden nicht veraendert.
# Aufruf: .\scripts\SiVex-Git-Sicherung.ps1 -ZipPath ..\SiVex.zip
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$ZipPath,
    [string]$Repository = 'https://github.com/sscheidl/SiVex.git'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'Git ist nicht installiert oder nicht im PATH. Bitte zuerst Git for Windows installieren.'
}
$ZipPath = [System.IO.Path]::GetFullPath($ZipPath)
if (-not [System.IO.File]::Exists($ZipPath)) {
    throw "ZIP-Datei nicht gefunden: $ZipPath"
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

# Bestehendes Archiv vorab pruefen und seine Eintraege nur lesend untersuchen.
$sourceZip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
try {
    $names = @($sourceZip.Entries | ForEach-Object { $_.FullName.Replace('\\', '/') })
    $trennFiles = @($names | Where-Object { $_ -match '(^|/)apps/trennlabor/' })
    $sourceChecks = [ordered]@{
        'Trennlabor-Pfade in Ursprungs-ZIP' = $trennFiles.Count
        'Trennlabor-JavaScript vorhanden'  = [bool](@($trennFiles | Where-Object { $_ -match '/js/.*\.js$' }).Count)
        'Trennlabor-Tests vorhanden'       = [bool](@($trennFiles | Where-Object { $_ -match '/tests/' }).Count)
        'Trennlabor-Releases vorhanden'    = [bool](@($trennFiles | Where-Object { $_ -match '/release/.*\.zip$' }).Count)
    }
} finally {
    $sourceZip.Dispose()
}

$directory = [System.IO.Path]::GetDirectoryName($ZipPath)
$base = [System.IO.Path]::GetFileNameWithoutExtension($ZipPath)
$output = Join-Path $directory ($base + '-mit-Git-Backup.zip')
if ([System.IO.File]::Exists($output)) {
    throw "Ausgabedatei existiert bereits und wird nicht ueberschrieben: $output"
}

$workspace = Join-Path ([System.IO.Path]::GetTempPath()) ('sivex-git-' + [guid]::NewGuid().ToString('N'))
[System.IO.Directory]::CreateDirectory($workspace) | Out-Null
$mirror = Join-Path $workspace 'SiVex.git'
$bundle = Join-Path $workspace 'SiVex-alle-Branches-und-Historie.bundle'
$manifestPath = Join-Path $workspace 'SICHERUNG-INFO.txt'

try {
    Write-Host 'Lade GitHub-Repository mit ALLEN Branches, Tags und Git-Historie ...'
    & git clone --mirror $Repository $mirror
    if ($LASTEXITCODE -ne 0) { throw 'git clone --mirror fehlgeschlagen.' }

    # Alle Branches und Tags festhalten; nur main ist Pflicht.
    $lines = @(& git --git-dir="$mirror" for-each-ref --format='%(refname) = %(objectname)' refs/heads refs/tags)
    if ($LASTEXITCODE -ne 0) { throw 'Git-Referenzen konnten nicht gelesen werden.' }
    if (-not ($lines -match '^refs/heads/main = ')) {
        throw 'Erwarteter Branch fehlt im geklonten Repository: main'
    }

    Write-Host 'Erzeuge vollstaendiges Git-Bundle ...'
    & git --git-dir="$mirror" bundle create $bundle --all
    if ($LASTEXITCODE -ne 0) { throw 'Erzeugung des Git-Bundles fehlgeschlagen.' }
    & git --git-dir="$mirror" bundle verify $bundle
    if ($LASTEXITCODE -ne 0) { throw 'Git-Bundle konnte nicht verifiziert werden.' }

    # Eine Zeile pro Element; Arrays wie $lines werden dabei aufgefaechert.
    $info = @(
        'SiVex Git-Sicherung'
        ('Erstellt (Ortszeit): ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'))
        ('Quelle: ' + $Repository)
        ('Original-ZIP: ' + $ZipPath)
        ('Original-ZIP SHA256: ' + (Get-FileHash -Algorithm SHA256 -LiteralPath $ZipPath).Hash)
        ''
        'Enthaltene Branches und Tags:'
        $lines
        ''
        'Bestandspruefung der Original-ZIP (kein exakter Dateivergleich mit GitHub):'
        ($sourceChecks.GetEnumerator() | ForEach-Object { $_.Key + ': ' + $_.Value })
        ''
        'Hinweis: Vollstaendige Git-Objekte und Historie liegen im .bundle.'
        'Wiederherstellung: git clone SiVex-alle-Branches-und-Historie.bundle SiVex-wiederhergestellt'
        'Das Bundle ist eine Kopie des GitHub-Stands zum Sicherungszeitpunkt.'
        'Loeschung von Branches/PRs ist NICHT Teil dieses Skripts.'
    )
    [System.IO.File]::WriteAllLines($manifestPath, [string[]]$info, [System.Text.UTF8Encoding]::new($true))

    Write-Host 'Kopiere ZIP und fuege Git-Bundle plus Sicherungsinfo hinzu ...'
    [System.IO.File]::Copy($ZipPath, $output, $false)
    $targetZip = [System.IO.Compression.ZipFile]::Open($output, [System.IO.Compression.ZipArchiveMode]::Update)
    try {
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $targetZip, $bundle, '_Git-Sicherung/SiVex-alle-Branches-und-Historie.bundle',
            [System.IO.Compression.CompressionLevel]::NoCompression
        ) | Out-Null
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $targetZip, $manifestPath, '_Git-Sicherung/SICHERUNG-INFO.txt',
            [System.IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null
    } finally {
        $targetZip.Dispose()
    }

    # Abschliessend sicherstellen, dass beide Sicherungseintraege im neuen ZIP existieren.
    $check = [System.IO.Compression.ZipFile]::OpenRead($output)
    try {
        foreach ($name in @('_Git-Sicherung/SiVex-alle-Branches-und-Historie.bundle', '_Git-Sicherung/SICHERUNG-INFO.txt')) {
            if ($null -eq $check.GetEntry($name)) { throw "Fehlender ZIP-Eintrag: $name" }
        }
    } finally {
        $check.Dispose()
    }
    Write-Host ''
    Write-Host 'SICHERUNG FERTIG:' -ForegroundColor Green
    Write-Host $output
    Write-Host 'Git-Referenzen:'
    $lines | ForEach-Object { Write-Host ('  ' + $_) }
    Write-Host 'Das Original-ZIP ist unveraendert.'
} finally {
    if ([System.IO.Directory]::Exists($workspace)) {
        Remove-Item -LiteralPath $workspace -Recurse -Force
    }
}
