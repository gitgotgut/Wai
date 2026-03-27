interface MessageBubbleProps {
  role: "user" | "assistant" | "system";
  content: string;
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
        isUser ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800"
      }`}>
        <p className="whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}
