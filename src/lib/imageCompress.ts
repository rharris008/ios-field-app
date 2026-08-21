// Compress a File/Blob to a base64 JPEG under targetKB.
// Used before storing in Dexie to keep offline queue small.
export function compressImage(file: File | Blob, maxWidthPx = 1280, qualityPct = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxWidthPx / img.width)
      const w = Math.round(img.width  * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', qualityPct))
    }
    img.onerror = reject
    img.src = url
  })
}
