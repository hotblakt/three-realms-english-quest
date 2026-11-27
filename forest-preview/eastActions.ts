type OneShot = 'attack' | 'dash' | 'cast';

const rules = {
  attack: { priority: 2, duration: 300 },
  dash: { priority: 3, duration: 160 },
  cast: { priority: 1, duration: 1400 },
} as const;

// Presentation state only. The existing player and sword own physics, hits and cooldowns.
export class EastActions {
  private active?: { name: OneShot; start: number; duration: number; releaseAt: number; released: boolean };

  start(name: OneShot, now: number, castTiming = { duration: 1400, releaseAt: 800 }): boolean {
    const active = this.current(now);
    if (active && rules[active.name].priority >= rules[name].priority) return false;
    const timing = name === 'cast' ? castTiming : { duration: rules[name].duration, releaseAt: 0 };
    this.active = { name, start: now, ...timing, released: false };
    return true;
  }

  current(now: number) {
    if (this.active && now - this.active.start >= this.active.duration) this.clear();
    return this.active;
  }

  releaseCast(now: number): boolean {
    const active = this.current(now);
    if (active?.name !== 'cast' || active.released || now - active.start < active.releaseAt) return false;
    active.released = true;
    return true;
  }

  clear(): void { this.active = undefined; }
}
