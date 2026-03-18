export class PlaybackClock {
  private anchorTick = 0;
  private anchorTimeMs = 0;
  private currentTick = 0;
  private endTick = 0;
  private playing = false;
  private speed = 1;
  private startTick = 0;
  private tickRate = 64;

  configure(startTick: number, endTick: number, tickRate: number, now = performance.now()) {
    this.startTick = startTick;
    this.endTick = endTick;
    this.tickRate = Math.max(1, tickRate || 64);
    this.seek(this.currentTick || startTick, now);
  }

  getTick(now = performance.now()) {
    if (!this.playing) {
      return this.currentTick;
    }

    const elapsedSeconds = Math.max(0, (now - this.anchorTimeMs) / 1000);
    return this.clamp(this.anchorTick + elapsedSeconds * this.tickRate * this.speed);
  }

  isPlaying() {
    return this.playing;
  }

  pause(now = performance.now()) {
    this.currentTick = this.getTick(now);
    this.playing = false;
  }

  play(now = performance.now()) {
    this.currentTick = this.getTick(now);
    this.anchorTick = this.currentTick;
    this.anchorTimeMs = now;
    this.playing = true;
  }

  seek(nextTick: number, now = performance.now()) {
    this.currentTick = this.clamp(nextTick);
    this.anchorTick = this.currentTick;
    this.anchorTimeMs = now;
  }

  setSpeed(nextSpeed: number, now = performance.now()) {
    this.currentTick = this.getTick(now);
    this.speed = nextSpeed;
    this.anchorTick = this.currentTick;
    this.anchorTimeMs = now;
  }

  private clamp(value: number) {
    return Math.max(this.startTick, Math.min(this.endTick, value));
  }
}
