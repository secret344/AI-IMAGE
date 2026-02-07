/**
 * 聊天框组件使用指南
 * Quick Reference for UploadChatPanel & UploadChatWrapper
 */

// ============================================================================
// 🎯 Option 1: 使用 UploadChatWrapper（推荐）
// ============================================================================
// 最简单的方式，适合集成到UploadPanel
// 自动处理所有细节（本地化、错误处理、样式等）

import { UploadChatWrapper } from '@/components/upload/UploadChatWrapper';
import { useUploadChat } from '@/hooks/useUploadChat';

function MyComponent() {
  const chatState = useUploadChat({
    taskId: 'unique-id',
    imageName: 'photo.jpg',
    agentStyle: 'Street Narrative',
    // 可选：加密密钥的密码短语
    // apiKeyPassphrase: userPassword,
  });

  return (
    <UploadChatWrapper
      chatState={chatState}
      imageName="photo.jpg"
      disabled={false}
    />
  );
}

// ============================================================================
// 🎯 Option 2: 直接使用 UploadChatPanel（完全控制）
// ============================================================================
// 用于需要完全控制的场景（自定义样式、特殊逻辑等）

import { UploadChatPanel } from '@/components/upload/UploadChatPanel';
import type { ChatMessage } from '@/types/conversation';

function MyCustomComponent() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async (message: string) => {
    setIsLoading(true);
    try {
      // 你的自定义发送逻辑
      const response = await myCustomAiApi(message);
      setMessages(prev => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: response,
          timestamp: Date.now(),
        }
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <UploadChatPanel
      messages={messages}
      onSend={handleSend}
      isLoading={isLoading}
      error={error}
      onClearError={() => setError(null)}
      title="My Custom Chat"
      emptyStateText="Start chatting..."
    />
  );
}

// ============================================================================
// 📝 Props Reference
// ============================================================================

// UploadChatPanel Props
interface UploadChatPanelProps {
  /** 聊天消息列表 */
  messages: ChatMessage[];
  /** 发送消息回调 */
  onSend: (message: string) => void;
  /** 是否加载中 */
  isLoading?: boolean;
  /** 错误消息 */
  error?: string | null;
  /** 清除错误回调 */
  onClearError?: () => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义标题 */
  title?: string;
  /** 自定义空状态文本 */
  emptyStateText?: string;
}

// UploadChatWrapper Props
interface UploadChatWrapperProps {
  /** 聊天hook返回值 */
  chatState: UseUploadChatReturn;
  /** 图片文件名 */
  imageName?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义标题 */
  title?: string;
}

// ============================================================================
// 🌐 国际化（i18n）
// ============================================================================

// 使用国际化文本
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();

  return (
    <div>
      {/* 自动返回当前语言的翻译 */}
      <h2>{t('chat.title')}</h2> {/* "Chat with Agent" 或 "与智能体讨论" */}
      <p>{t('chat.emptyState')}</p>
      <button>{t('common.close')}</button>
    </div>
  );
}

// ============================================================================
// 🔧 useUploadChat Hook 详细用法
// ============================================================================

import { useUploadChat } from '@/hooks/useUploadChat';

function MyUploadComponent() {
  // 初始化Hook
  const chatState = useUploadChat({
    taskId: 'task-123',
    agentStyle: 'Street Narrative',
    imageName: 'photo.jpg',
    evaluationResultSummary: '图片得分: 85/100',
    // 可选：加密密钥的密码短语
    apiKeyPassphrase: undefined, // 如果没有密码短语，使用空字符串
  });

  // Hook返回值
  // - messages: ChatMessage[] - 所有消息列表
  // - isLoading: boolean - 是否正在加载
  // - error: string | null - 错误消息
  // - analysisSuggestion: string | null - AI分析建议
  // - shouldShowAnalysisSuggestion: boolean - 是否显示建议
  // - sendMessage: (message: string) => Promise<void> - 发送消息
  // - confirmAnalysis: () => void - 确认分析建议
  // - clearError: () => void - 清除错误
  // - clearMessages: () => void - 清空所有消息

  return (
    <>
      {/* 发送消息 */}
      <button onClick={() => chatState.sendMessage('Hello!')}>
        {chatState.isLoading ? 'Sending...' : 'Send'}
      </button>

      {/* 显示错误 */}
      {chatState.error && (
        <div>
          {chatState.error}
          <button onClick={() => chatState.clearError()}>Clear</button>
        </div>
      )}

      {/* 显示分析建议 */}
      {chatState.shouldShowAnalysisSuggestion && (
        <div>
          <p>AI suggests: {chatState.analysisSuggestion}</p>
          <button onClick={() => chatState.confirmAnalysis()}>Confirm</button>
        </div>
      )}
    </>
  );
}

// ============================================================================
// 🔐 API密钥管理（密码短语使用）
// ============================================================================

import { loadApiKey, saveApiKey } from '@/modules/storage/keys';

// 保存API密钥（加密）
async function saveUserApiKey() {
  const userPassphrase = prompt('Enter passphrase to encrypt your API key:');
  await saveApiKey('openai', 'sk-xxx...', userPassphrase);
}

// 加载API密钥（解密）
async function loadUserApiKey() {
  const userPassphrase = prompt('Enter passphrase to decrypt:');
  const apiKey = await loadApiKey('openai', userPassphrase);
  if (!apiKey) {
    console.error('Wrong passphrase or key not found');
  }
  return apiKey;
}

// 在聊天Hook中使用
const chatState = useUploadChat({
  taskId: 'task-123',
  imageName: 'photo.jpg',
  agentStyle: 'Street Narrative',
  apiKeyPassphrase: userPassphrase, // 传递用户的密码短语
});

// ============================================================================
// 📱 快捷键支持
// ============================================================================

// UploadChatPanel 内置支持以下快捷键：
// - Cmd+Enter (macOS) / Ctrl+Enter (Windows/Linux) - 发送消息
// 无需额外配置，自动支持

// ============================================================================
// 🎨 Material Design 3 样式自定义
// ============================================================================

// UploadChatPanel 使用以下Material Design 3原则：
// - 间距: 8px网格基准 (Material Design 3)
// - 排版: 层级式标题/正文/标题
// - 颜色: 语义化色彩 (primary, destructive, muted等)
// - 深度: 渐变、模糊、阴影效果
// - 交互: 焦点状态、动画反馈
//
// 如需自定义样式，直接修改组件内的Tailwind类名

// ============================================================================
// 🧪 示例：完整集成示例
// ============================================================================

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UploadChatWrapper } from '@/components/upload/UploadChatWrapper';
import { useUploadChat } from '@/hooks/useUploadChat';

export function ChatIntegrationExample() {
  const { t } = useTranslation();
  const [fileName, setFileName] = useState('example.jpg');
  
  // 初始化聊天状态
  const chatState = useUploadChat({
    taskId: `example-${Date.now()}`,
    imageName: fileName,
    agentStyle: 'Street Narrative',
  });

  // 处理上传
  const handleFileUpload = useCallback((file: File) => {
    setFileName(file.name);
  }, []);

  // 处理分析建议确认
  const handleConfirmAnalysis = useCallback(() => {
    chatState.confirmAnalysis();
    // 触发后续分析流程
  }, [chatState]);

  return (
    <div className="space-y-4">
      {/* 上传区域 */}
      <Card>
        <input 
          type="file" 
          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
        />
      </Card>

      {/* 聊天框 */}
      <UploadChatWrapper
        chatState={chatState}
        imageName={fileName}
      />

      {/* 分析建议按钮 */}
      {chatState.shouldShowAnalysisSuggestion && (
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => chatState.clearMessages()}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleConfirmAnalysis}>
            {t('common.confirm')}
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 🐛 常见问题排查
// ============================================================================

/**
 * Q: 发送消息时报"API key not configured"错误
 * A: 确保：
 *    1. 在Settings中配置了API密钥
 *    2. 如果使用密码短语加密，需要在useUploadChat选项中传递正确的密码短语
 *    3. 检查loadApiKey调用是否使用了正确的keyLabel
 * 
 * Q: 聊天框显示为空
 * A: 检查：
 *    1. messages属性是否正确传递
 *    2. 是否有错误信息（error属性）被设置
 *    3. 消息对象是否有id和timestamp字段
 * 
 * Q: 快捷键不工作
 * A: 确保：
 *    1. 焦点在输入框中
 *    2. 按的是Cmd+Enter (macOS) 或 Ctrl+Enter (Windows/Linux)
 *    3. 消息不为空
 * 
 * Q: 样式显示不对
 * A: 检查：
 *    1. Tailwind CSS是否正确加载
 *    2. Material Design 3 配置是否生效
 *    3. 是否有其他CSS覆盖了样式
 */

export { /* Types */ };
