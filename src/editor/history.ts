export class History<T> {
  private past: T[] = [];
  private future: T[] = [];
  constructor(
    public current: T,
    private limit = 100,
  ) {}
  commit(next: T): T {
    if (JSON.stringify(next) === JSON.stringify(this.current)) return this.current;
    this.past.push(this.current);
    if (this.past.length > this.limit) this.past.shift();
    this.current = next;
    this.future = [];
    return next;
  }
  undo(): T {
    if (this.past.length) {
      this.future.push(this.current);
      this.current = this.past.pop()!;
    }
    return this.current;
  }
  redo(): T {
    if (this.future.length) {
      this.past.push(this.current);
      this.current = this.future.pop()!;
    }
    return this.current;
  }
  reset(next: T): T {
    this.past = [];
    this.future = [];
    return (this.current = next);
  }
  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
}
