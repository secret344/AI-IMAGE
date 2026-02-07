/**
 * 聊天模块类型定义 (v1: 单线程，v2+: 预留多线程支持)
 * 低耦合设计：独立的类型定义，无其他模块依赖
 */

/** 聊天消息 */
export interface ChatMessage {
  id: string;                    // UUID
  role: 'user' | 'assistant';   // 消息角色
  content: string;              // 消息内容
  timestamp: number;            // 时间戳 (ms)
  threadId?: string;            // [预留] 线程ID，用于多线程支持
  modelUsed?: string;           // [预留] 使用的模型名称
}

/** 聊天线程 (v1: 单主线程；v2+: 支持多线程讨论) */
export interface ConversationThread {
  threadId: string;             // 唯一线程ID
  name: string;                 // 线程名称 e.g. "主讨论" "构图优化"
  purpose?: 'main' | 'refinement' | 'deepdive'; // [预留] 线程用途分类
  messages: ChatMessage[];      // 该线程的所有消息
  createdAt: number;            // 创建时间
  updatedAt: number;            // 最后更新时间
}

/** 任务关联的聊天数据 */
export interface TaskConversationData {
  defaultThread: ConversationThread; // 主线程
  additionalThreads?: ConversationThread[]; // [预留] 其他讨论线程
  conversationSummary?: string; // [预留] 聊天摘要，用于重评时注入
}

/** 聊天API调用配置 (预留多模型支持) */
export interface ChatRequestConfig {
  modelType?: 'evaluation-chat' | 'refinement-chat' | 'deepdive-chat'; // [预留] 聊天用途
  provider: 'openai' | 'gemini' | 'claude' | 'ollama'; // AI服务商
  apiKey: string; // API密钥
  temperature?: number; // 模型参数 (默认0.7)
  maxTokens?: number;   // 最大令牌数
}

/** 聊天上下文信息 (传递给AI的关键信息) */
export interface ChatContext {
  taskId: string;                      // 所属任务
  agentStyle: string;                  // 当前评估角色
  evaluationResultSummary?: string;    // 原始评估结果摘要
  conversationHistory: ChatMessage[];  // 聊天历史
  userFeedback?: string;              // 用户最新反馈
}
