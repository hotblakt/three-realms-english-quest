type OneShot = 'attack' | 'dash' | 'cast';

const rules = {
  attack: { priority: 2, duration: 300 },
  dash: { priority: 3, duration: 160 },
  cast: { priority: 1, duration: 1400 },
} as const;

// Presentation state only. The existing player and sword own physics, hits and cooldowns.
export class EastActions {
  private active?: { name: OneShot; start: number; released: boolean };

  start(name: OneShot, now: number): boolean {
    const active = this.current(now);
    if (active && rules[active.name].priority >= rules[name].priority) return false;
    this.active = { name, start: now, released: false };
    return true;
  }

  current(now: number) {
    if (this.active && now - this.active.start >= rules[this.active.name].duration) this.clear();
    return this.active;
  }

  releaseCast(now: number): boolean {
    const active = this.current(now);
    if (active?.name !== 'cast' || active.released || now - active.start < 800) return false;
    active.released = true;
    return true;
  }

  clear(): void { this.active = undefined; }
}
