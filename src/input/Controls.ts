import Phaser from 'phaser';

type Action = 'attack' | 'dodge' | 'interact';

export class Controls {
  private readonly actions = new Set<Action>();
  private readonly joystick = new Phaser.Math.Vector2();
  private readonly stick = document.querySelector<HTMLElement>('#stick')!;
  private readonly knob = document.querySelector<HTMLElement>('#knob')!;
  private readonly listeners = new AbortController();
  private pointer: number | null = null;
  private readonly keys;

  constructor(keyboard: Phaser.Input.Keyboard.KeyboardPlugin) {
    this.keys = keyboard.addKeys({
      up: 'W', down: 'S', left: 'A', right: 'D',
      arrowUp: 'UP', arrowDown: 'DOWN', arrowLeft: 'LEFT', arrowRight: 'RIGHT',
      attack: 'J', dodge: 'SPACE', interact: 'E',
    }) as Record<string, Phaser.Input.Keyboard.Key>;
    const options = { signal: this.listeners.signal };
    this.stick.addEventListener('pointerdown', (event) => {
      if (this.pointer !== null) return;
      this.pointer = event.pointerId;
      this.stick.setPointerCapture(event.pointerId);
      this.moveStick(event);
    }, options);
    this.stick.addEventListener('pointermove', (event) => this.moveStick(event), options);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
      this.stick.addEventListener(type, (event) => {
        if (event.pointerId === this.pointer) this.clearStick();
      }, options);
    }
    window.addEventListener('blur', () => {
      this.clearStick();
      this.actions.clear();
    }, options);
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action]')) {
      const action = button.dataset.action as Action;
      button.addEventListener('pointerdown', (event) => {
        if (event.button === 0) this.actions.add(action);
      }, options);
      button.addEventListener('click', (event) => {
        if (event.detail === 0) this.actions.add(action);
      }, options);
    }
  }

  private moveStick(event: PointerEvent): void {
    if (event.pointerId !== this.pointer) return;
    const rect = this.stick.getBoundingClientRect();
    const reach = rect.width * .3;
    this.joystick.set(event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2);
    this.joystick.scale(1 / reach).limit(1);
    this.knob.style.transform = `translate(${this.joystick.x * reach}px, ${this.joystick.y * reach}px)`;
  }

  private clearStick(): void {
    this.pointer = null;
    this.joystick.reset();
    this.knob.style.transform = '';
  }

  direction(): Phaser.Math.Vector2 {
    const { left, right, up, down, arrowLeft, arrowRight, arrowUp, arrowDown } = this.keys;
    const x = Number(right.isDown || arrowRight.isDown) - Number(left.isDown || arrowLeft.isDown);
    const y = Number(down.isDown || arrowDown.isDown) - Number(up.isDown || arrowUp.isDown);
    const direction = x || y ? new Phaser.Math.Vector2(x, y) : this.joystick;
    if (direction.lengthSq() < .09) return new Phaser.Math.Vector2();
    return Math.abs(direction.x) > Math.abs(direction.y)
      ? new Phaser.Math.Vector2(Math.sign(direction.x), 0)
      : new Phaser.Math.Vector2(0, Math.sign(direction.y));
  }

  consume(action: Action): boolean {
    const keyboard = Phaser.Input.Keyboard.JustDown(this.keys[action]);
    return this.actions.delete(action) || keyboard;
  }

  destroy(): void {
    this.listeners.abort();
    this.clearStick();
  }
}
