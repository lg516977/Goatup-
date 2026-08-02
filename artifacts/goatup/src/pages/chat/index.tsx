import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useParams } from "wouter";
import { Sidebar } from "@/components/chat/sidebar";
import { ChatArea } from "@/components/chat/chat-area";

export default function ChatMain() {
  const { user, isLoading } = useAuthGuard(true);
  const params = useParams();
  const activeConversationId = params.id ? parseInt(params.id) : null;

  if (isLoading || !user) {
    return (
      <div className="flex h-screen bg-background items-center justify-center">
        <div className="animate-pulse w-8 h-8 rounded-full bg-primary/20"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar - hidden on mobile if a chat is active */}
      <div className={`w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-border bg-sidebar flex flex-col ${activeConversationId ? 'hidden md:flex' : 'flex'}`}>
        <Sidebar activeId={activeConversationId} currentUser={user} />
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col min-w-0 ${!activeConversationId ? 'hidden md:flex' : 'flex'}`}>
        {activeConversationId ? (
          <ChatArea conversationId={activeConversationId} currentUser={user} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-background">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-6">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-muted-foreground">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-medium text-foreground mb-2">Goatup Web</h2>
            <p className="text-muted-foreground max-w-sm">
              Send and receive messages privately. Your conversations are end-to-end encrypted.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
