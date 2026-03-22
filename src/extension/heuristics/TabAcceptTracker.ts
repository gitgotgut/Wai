/**
 * Tracks Tab keypresses to improve Copilot completion detection.
 *
 * When the user presses Tab and a large text insertion follows within 200 ms,
 * it is very likely a Copilot ghost-text acceptance (confidence 0.95).
 * If no change arrives within 200 ms the flag is cleared — plain indentation.
 */
export class TabAcceptTracker {
  private recentTabAccept = false;
  private clearTimer: ReturnType<typeof setTimeout> | null = null;

  /** Call this when Tab is pressed in the editor. */
  recordTabPress(): void {
    this.recentTabAccept = true;
    if (this.clearTimer) {
      clearTimeout(this.clearTimer);
    }
    this.clearTimer = setTimeout(() => {
      this.recentTabAccept = false;
    }, 200);
  }

  /** Returns true and resets the flag. Returns false if no Tab was pending. */
  consumeTabAccept(): boolean {
    if (this.recentTabAccept) {
      this.recentTabAccept = false;
      if (this.clearTimer) {
        clearTimeout(this.clearTimer);
        this.clearTimer = null;
      }
      return true;
    }
    return false;
  }
}
