import type { SyncAck, SyncChange } from '@drefluxo/contracts';

export class SyncQueue {
  private readonly pending: SyncChange[] = [];

  enqueue(change: SyncChange): void {
    const index = this.pending.findIndex((item) => item.id === change.id);
    if (index >= 0) this.pending[index] = change;
    else this.pending.push(change);
  }

  snapshot(): SyncChange[] { return [...this.pending]; }

  acknowledge(result: SyncAck): void {
    const accepted = new Set(result.accepted);
    for (let i = this.pending.length - 1; i >= 0; i -= 1) {
      if (accepted.has(this.pending[i].id)) this.pending.splice(i, 1);
    }
  }
}
