
$res = Invoke-WebRequest -Uri "https://api.github.com/repos/${Env:GITHUB_REPOSITORY}/releases" -Headers @{'Authorization' = "token ${Env:GITHUB_TOKEN}"}
$jsonObj = ConvertFrom-Json $([String]::new($res.Content))

$selectedRelease = $null
Foreach ($release in $jsonObj)
{
    if ( ! $release.body -contains "- jobId: ${Env:GITHUB_RUN_ID}\\r\\n") {
        continue
    }
    if ( ! $release.draft ) {
        continue
    }
    $selectedRelease = $release
    break
}

if ( $null -eq $selectedRelease ) {
    exit 1
}

$tagName = $selectedRelease.tag_name
$releaseId = $selectedRelease.id
Write-Output "::set-output name=version::$tagName"
Write-Output "::set-output name=release_id::$releaseId"