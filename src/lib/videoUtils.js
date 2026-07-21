// Grabs a single frame from a video file as a JPEG blob, for use as a
// thumbnail/poster. Loads the file into a hidden <video>, seeks to a point
// a little into the clip (avoids all-black opening frames), then draws
// the current frame to a canvas.
export function captureThumbnail(file, seekTo = 1) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    const url = URL.createObjectURL(file)
    video.src = url

    const cleanup = () => URL.revokeObjectURL(url)

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(seekTo, Math.max(video.duration - 0.1, 0))
    }
    video.onseeked = () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => {
        cleanup()
        if (blob) resolve({ blob, duration: video.duration })
        else reject(new Error('Failed to capture thumbnail'))
      }, 'image/jpeg', 0.85)
    }
    video.onerror = () => { cleanup(); reject(new Error('Failed to load video')) }
  })
}

// Whether trimming is supported in this browser at all.
export function supportsTrimming() {
  return typeof HTMLVideoElement.prototype.captureStream === 'function' &&
    typeof window.MediaRecorder !== 'undefined'
}

// Re-encodes the [start, end] seconds of a video file into a new blob by
// playing it back and recording the captured stream. This runs in real
// time (a 10s trim takes ~10s to process) since there's no ffmpeg
// available client-side — acceptable for short clips, not ideal for long
// ones. Good enough without a server-side transcoding pipeline.
export function trimVideo(file, start, end) {
  return new Promise((resolve, reject) => {
    if (!supportsTrimming()) { reject(new Error('Trimming not supported in this browser')); return }

    const video = document.createElement('video')
    video.muted = false
    video.playsInline = true
    const url = URL.createObjectURL(file)
    video.src = url

    video.onloadedmetadata = () => {
      video.currentTime = start
    }

    video.onseeked = () => {
      const stream = video.captureStream()
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' })
      const chunks = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
      recorder.onstop = () => {
        URL.revokeObjectURL(url)
        resolve(new Blob(chunks, { type: 'video/webm' }))
      }
      recorder.onerror = e => { URL.revokeObjectURL(url); reject(e.error) }

      recorder.start()
      video.play()
      const stopAt = () => {
        if (video.currentTime >= end || video.ended) {
          video.pause()
          recorder.stop()
        } else {
          requestAnimationFrame(stopAt)
        }
      }
      requestAnimationFrame(stopAt)
    }

    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load video')) }
  })
}