// File → { data: base64 without the "data:" prefix, mime }. Photos are downscaled to ≤ 2000 px and sent as
// JPEG (timetable-import spec); PDFs are sent as they are. Nothing is stored: the image only lives in memory.
export async function toBase64(file) {
  if (file.type === 'application/pdf') {
    const buf = new Uint8Array(await file.arrayBuffer())
    let bin = ''
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    return { data: btoa(bin), mime: file.type }
  }
  const img = await createImageBitmap(file)
  const scale = Math.min(1, 2000 / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
  return { data: canvas.toDataURL('image/jpeg', 0.85).split(',')[1], mime: 'image/jpeg' }
}

export const TIMETABLE_TYPES = ['image/png', 'image/jpeg', 'application/pdf']
