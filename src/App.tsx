import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Plane, MapPin, Compass, Loader2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createTravelChat } from './services/gemini';
import { GenerateContentResponse } from '@google/genai';

type Message = {
  id: string;
  role: 'user' | 'model';
  content: string;
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      content: '你好！我是你的专属 AI 旅游规划师。你想去哪里旅行？可以告诉我你的目的地、出行天数、预算偏好以及感兴趣的活动，我来为你定制专属攻略！\n\n---SUGGESTED---\n- 帮我推荐几个适合情侣度假的海岛\n- 我想去日本京都玩5天，预算1万元\n- 国内有哪些适合带父母去的小众旅游地？',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Use a ref to store the chat instance so it persists across renders
  const chatRef = useRef<any>(null);

  useEffect(() => {
    // Initialize the chat session once
    if (!chatRef.current) {
      chatRef.current = createTravelChat();
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      if (!chatRef.current) {
        throw new Error("Chat not initialized");
      }

      const responseStream = await chatRef.current.sendMessageStream({
        message: userMessage.content,
      });

      const modelMessageId = (Date.now() + 1).toString();
      setMessages((prev) => [
        ...prev,
        { id: modelMessageId, role: 'model', content: '' },
      ]);

      for await (const chunk of responseStream) {
        const c = chunk as GenerateContentResponse;
        if (c.text) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === modelMessageId
                ? { ...msg, content: msg.content + c.text }
                : msg
            )
          );
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'model',
          content: '抱歉，我遇到了一些问题，无法回复。请稍后再试。',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const parseMessageContent = (content: string) => {
    const parts = content.split('---SUGGESTED---');
    const mainContent = parts[0].trim();
    let questions: string[] = [];
    if (parts.length > 1) {
      questions = parts[1]
        .split('\n')
        .map(q => q.replace(/^[-*0-9.]+\s*/, '').trim())
        .filter(q => q.length > 0 && !q.startsWith('```'));
    }
    return { mainContent, questions };
  };

  return (
    <div className="flex flex-col h-screen bg-stone-50 font-sans text-stone-800">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-stone-200 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 text-emerald-600">
            <Plane size={24} className="transform rotate-45" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-stone-900 tracking-tight">AI 旅游规划师</h1>
            <p className="text-xs text-stone-500 font-medium">你的私人定制向导</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-stone-400">
          <MapPin size={20} />
          <Compass size={20} />
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((message) => {
            const { mainContent, questions } = message.role === 'model' 
              ? parseMessageContent(message.content) 
              : { mainContent: message.content, questions: [] };

            return (
              <div key={message.id} className={`flex flex-col gap-2 ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`flex gap-4 ${
                    message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  } w-full`}
                >
                  {/* Avatar */}
                  <div
                    className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full ${
                      message.role === 'user'
                        ? 'bg-indigo-100 text-indigo-600'
                        : 'bg-emerald-100 text-emerald-600'
                    }`}
                  >
                    {message.role === 'user' ? <User size={20} /> : <Plane size={20} className="transform rotate-45" />}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-4 shadow-sm ${
                      message.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-sm'
                        : 'bg-white border border-stone-100 rounded-tl-sm'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <p className="whitespace-pre-wrap leading-relaxed">{mainContent}</p>
                    ) : (
                      <div className="prose prose-stone prose-sm sm:prose-base max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {mainContent}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Suggested Questions */}
                {message.role === 'model' && questions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1 ml-14 sm:ml-14 max-w-[85%] sm:max-w-[75%]">
                    {questions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(q)}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-emerald-200 text-emerald-700 rounded-xl hover:bg-emerald-50 transition-colors shadow-sm disabled:opacity-50 text-left leading-snug"
                      >
                        <Sparkles size={14} className="flex-shrink-0" />
                        <span>{q}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {isLoading && (
            <div className="flex gap-4 flex-row">
              <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 text-emerald-600">
                <Plane size={20} className="transform rotate-45" />
              </div>
              <div className="bg-white border border-stone-100 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm flex items-center gap-2 text-stone-500">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm font-medium">正在为你规划行程...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="bg-white border-t border-stone-200 p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          {/* Quick Prompts */}
          <div className="flex flex-wrap gap-2 mb-3">
            {[
              {
                icon: '🎯',
                label: '目的地推荐',
                text: '我想去旅行。我的偏好是：[自然风光/历史文化/美食/冒险]（请修改），旅行类型是：[家庭游/情侣游/独自旅行]（请修改）。请为我推荐3个合适的目的地，并简要介绍推荐理由。'
              },
              {
                icon: '📅',
                label: '行程规划',
                text: '请帮我规划行程。目的地：[请填写]，旅行天数：[请填写]天，总预算：[请填写]，感兴趣的活动：[请填写]。请生成一份详细的每日行程安排，包括景点、餐饮、交通建议和大致花费估算。'
              },
              {
                icon: '🌤️',
                label: '天气与交通',
                text: '请帮我查询 [请填写目的地] 未来几天的最新天气预报，以及当前的实时交通状况（如拥堵情况、公共交通是否延误等）。'
              }
            ].map((prompt, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setInput(prompt.text)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-stone-200 text-stone-600 rounded-full hover:bg-stone-50 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
              >
                <span>{prompt.icon}</span>
                <span>{prompt.label}</span>
              </button>
            ))}
          </div>
          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-3 bg-stone-50 border border-stone-200 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="例如：我想去日本京都玩5天，预算1万元，喜欢寺庙和美食..."
              className="flex-1 max-h-32 min-h-[44px] bg-transparent border-none focus:ring-0 resize-none py-3 px-4 text-stone-800 placeholder:text-stone-400"
              rows={1}
              style={{
                height: 'auto',
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 transition-colors"
            >
              <Send size={20} />
            </button>
          </form>
          <div className="mt-3 text-center">
            <p className="text-xs text-stone-400">
              AI 可能会犯错，请在出行前核实重要信息（如签证、航班、酒店预订等）。
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
