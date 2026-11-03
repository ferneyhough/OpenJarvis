[CmdletBinding()]
param(
	[Parameter(Mandatory = $true)]
	[string]$BundlePath
)

$bundle = Get-Item -LiteralPath $BundlePath -ErrorAction Stop
$nativeFiles = Get-ChildItem -LiteralPath $bundle.FullName -Recurse -File -ErrorAction Stop |
	Where-Object { $_.Name -match '(?i)^libcurl.*\.(dll|pdb)$' }

$debugFiles = $nativeFiles | Where-Object {
	$_.Extension -ieq '.pdb' -or $_.Name -match '(?i)(debug|[_-]d)\.(dll|pdb)$'
}

if ($debugFiles) {
	Write-Error ('Debug-enabled libcurl artifacts are not allowed in production: ' +
		(($debugFiles | ForEach-Object FullName) -join ', '))
	exit 1
}

Write-Host 'Production native dependency check passed.'
exit 0
