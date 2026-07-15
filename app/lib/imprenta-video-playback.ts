"use client"

/**
 * Global manager for video playback in the Imprenta canvas.
 * Restricts the number of concurrently playing videos to avoid hardware decoder starvation.
 * Browsers typically support 4-16 hardware decoders before falling back to software or freezing.
 */

const MAX_CONCURRENT_VIDEOS = 3;

class ImprentaVideoManager {
  private playingVideos: Set<HTMLVideoElement> = new Set();
  
  public acquire(video: HTMLVideoElement) {
    if (this.playingVideos.has(video)) return;
    
    // If we reached the limit, pause the oldest video
    if (this.playingVideos.size >= MAX_CONCURRENT_VIDEOS) {
      const oldest = Array.from(this.playingVideos)[0];
      if (oldest) {
        this.release(oldest);
      }
    }
    
    this.playingVideos.add(video);
    video.play().catch(() => {
      // Ignore autoplay errors (usually user-interaction policy)
    });
  }
  
  public release(video: HTMLVideoElement) {
    if (this.playingVideos.has(video)) {
      video.pause();
      this.playingVideos.delete(video);
    }
  }
  
  public clear() {
    this.playingVideos.forEach(video => {
      video.pause();
    });
    this.playingVideos.clear();
  }
}

export const imprentaVideoManager = new ImprentaVideoManager();
