import { CommandResult, ChartData, InventoryItem } from "@/types";

// Helper function to ensure we only use valid action types
function getValidActionType(action: string): 'add' | 'remove' | 'set' | 'view' | 'query' | 'export' | 'email' {
  const validActions = ['add', 'remove', 'set', 'view', 'query', 'export', 'email'] as const;
  
  if (validActions.includes(action as any)) {
    return action as 'add' | 'remove' | 'set' | 'view' | 'query' | 'export' | 'email';
  }
  
  // Default to 'view' instead of 'unknown'
  return 'view';
}

// Process command function
export async function processCommand(
  command: string,
  inventory?: InventoryItem[],
  conversationHistory?: string[]
): Promise<CommandResult> {
  // This is a placeholder function - the actual implementation is elsewhere
  // We're just fixing the type signature here
  
  // Default return value with correct action type
  return {
    action: getValidActionType('view'),
    response: "Command processed",
  };
}
