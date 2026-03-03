interface PendingAction {
  id: string;
  channel: string;
  action: string;
  description: string;
  createdAt: Date;
}

const pendingActions: Map<string, PendingAction> = new Map();

export function getPendingActionsByChannel(channel: string): PendingAction[] {
  return Array.from(pendingActions.values()).filter((a) => a.channel === channel);
}

export function addPendingAction(action: PendingAction): void {
  pendingActions.set(action.id, action);
}

export function confirmAction(id: string): PendingAction | null {
  const action = pendingActions.get(id);
  if (action) {
    pendingActions.delete(id);
    return action;
  }
  return null;
}

export function cancelAction(id: string): boolean {
  return pendingActions.delete(id);
}

export function cancelAllActions(channel?: string): number {
  if (!channel) {
    const count = pendingActions.size;
    pendingActions.clear();
    return count;
  }
  let count = 0;
  for (const [id, action] of pendingActions) {
    if (action.channel === channel) {
      pendingActions.delete(id);
      count++;
    }
  }
  return count;
}
