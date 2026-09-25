async function refreshDownload() {
  try {
    const response = await fetch('/api/download', { cache: 'no-store' })
    if (!response.ok) throw new Error('Unavailable')
    const installer = await response.json()
    const available = !!installer.url
    for (const link of document.querySelectorAll('.download-link')) {
      link.href = available ? installer.url : '#download'
      link.setAttribute('aria-disabled', String(!available))
    }
    for (const text of document.querySelectorAll('.download-meta')) text.textContent = available
      ? `${installer.version ? `v${installer.version} · ` : ''}Windows · ${Math.ceil(installer.size / 1024 / 1024)} MB · Direct download`
      : 'Windows · Installer coming soon'
    document.querySelector('.download-status').textContent = available ? '' : 'The installer isn’t available yet. Please check back soon.'
  } catch {
    document.querySelector('.download-status').textContent = 'Could not check download availability. Try the download button again in a moment.'
  }
}
refreshDownload()
setInterval(refreshDownload, 30000)
