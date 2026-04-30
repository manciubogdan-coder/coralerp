import React from "react";
import { useNavigate } from "react-router-dom";
import { CheckSquare, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCollaborationAlerts } from "@/contexts/CollaborationAlertsContext";

const formatCount = (count: number) => (count > 99 ? "99+" : String(count));

const CollaborationAlertBadges: React.FC = () => {
  const navigate = useNavigate();
  const { chatUnread, taskUnread, markChatSeen, markTasksSeen } = useCollaborationAlerts();

  if (chatUnread === 0 && taskUnread === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {chatUnread > 0 && (
        <Button
          variant="secondary"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs font-semibold"
          onClick={() => {
            markChatSeen();
            navigate("/chat");
          }}
          title="Mesaje noi în chat"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Chat
          <span className="ml-0.5 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] leading-none text-destructive-foreground">
            {formatCount(chatUnread)}
          </span>
        </Button>
      )}
      {taskUnread > 0 && (
        <Button
          variant="secondary"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs font-semibold"
          onClick={() => {
            markTasksSeen();
            navigate("/taskuri");
          }}
          title="Taskuri modificate"
        >
          <CheckSquare className="h-3.5 w-3.5" />
          Taskuri
          <span className="ml-0.5 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] leading-none text-destructive-foreground">
            {formatCount(taskUnread)}
          </span>
        </Button>
      )}
    </div>
  );
};

export default CollaborationAlertBadges;