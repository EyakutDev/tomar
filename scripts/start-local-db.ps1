$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$localRoot = Join-Path $projectRoot '.local'
$cluster = Join-Path $localRoot 'postgres'
$passwordFile = Join-Path $localRoot 'db-password.txt'
$logFile = Join-Path $localRoot 'postgres.log'
$envFile = Join-Path $projectRoot '.env'
$bin = 'D:\PostgreSQL\18\bin'
$initdb = Join-Path $bin 'initdb.exe'
$pgctl = Join-Path $bin 'pg_ctl.exe'
$psql = Join-Path $bin 'psql.exe'
$createdb = Join-Path $bin 'createdb.exe'

foreach ($program in @($initdb, $pgctl, $psql, $createdb)) {
  if (-not (Test-Path -LiteralPath $program)) { throw "PostgreSQL programı bulunamadı: $program" }
}

New-Item -ItemType Directory -Path $localRoot -Force | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $cluster 'PG_VERSION'))) {
  if (Test-Path -LiteralPath $cluster) { throw 'Eksik yerel veritabanı klasörü bulundu; otomatik üzerine yazılmadı.' }
  $bytes = New-Object byte[] 24
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  $password = [BitConverter]::ToString($bytes).Replace('-', '')
  [System.IO.File]::WriteAllText($passwordFile, $password)
  & $initdb -D $cluster -U merak --pwfile=$passwordFile --auth=scram-sha-256 --locale=C --encoding=UTF8 --no-instructions
  if ($LASTEXITCODE -ne 0) { throw 'Yerel PostgreSQL kurulumu tamamlanamadı.' }
}

if (-not (Test-Path -LiteralPath $passwordFile)) { throw 'Yerel veritabanı parolası bulunamadı.' }
$password = [System.IO.File]::ReadAllText($passwordFile).Trim()

& $pgctl -D $cluster status 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  & $pgctl -D $cluster -l $logFile -o '-h 127.0.0.1 -p 5433' start
  if ($LASTEXITCODE -ne 0) { throw 'Yerel PostgreSQL başlatılamadı.' }
}

$env:PGPASSWORD = $password
try {
  $exists = & $psql -h 127.0.0.1 -p 5433 -U merak -d postgres -Atqc "SELECT 1 FROM pg_database WHERE datname = 'merak'"
  if ($LASTEXITCODE -ne 0) { throw 'Yerel PostgreSQL bağlantısı başarısız.' }
  if ($exists -ne '1') {
    & $createdb -h 127.0.0.1 -p 5433 -U merak -E UTF8 --locale=C --template=template0 merak
    if ($LASTEXITCODE -ne 0) { throw 'Merak veritabanı oluşturulamadı.' }
  }
  $encoding = & $psql -h 127.0.0.1 -p 5433 -U merak -d merak -Atqc 'SHOW server_encoding'
  if ($LASTEXITCODE -ne 0 -or $encoding -ne 'UTF8') { throw 'Merak veritabanı UTF-8 değil.' }
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

if (-not (Test-Path -LiteralPath $envFile)) {
  @(
    "DATABASE_URL=postgres://merak:$password@127.0.0.1:5433/merak"
    'PORT=3001'
    'HOST=127.0.0.1'
    'TRUST_PROXY=false'
  ) | Set-Content -LiteralPath $envFile -Encoding utf8
}

Write-Output 'Yerel Merak PostgreSQL hazır (127.0.0.1:5433).'
