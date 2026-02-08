/**
 * Thinking content helpers
 * Responsibilities: extract and strip model thinking segments from text
 * Features: supports marker, XML tag, and fenced thinking formats
 * Supported formats:
 * - [[THINKING]]...[[/THINKING]]
 * - <think|thinking|thought|thoughts|reasoning|analysis>...</...>
 * - [思考]...[/思考], 【思考】...【/思考】
 * - ```thinking|think|thoughts|reasoning|analysis
 */

const THINKING_START_MARKER = '[[THINKING]]';
const THINKING_END_MARKER = '[[/THINKING]]';

// XML-style tags: <think>, <thinking>, <thought>, <thoughts>, <reasoning>, <analysis>
const THINK_TAG_REGEX = /<(think|thinking|thought|thoughts|reasoning|analysis)>[\s\S]*?<\/\1>/gi;

// Chinese markers: [思考]...[/思考], 【思考】...【/思考】 (must be paired)
const CN_THINKING_SQUARE_REGEX = /\[思考\][\s\S]*?\[\/思考\]/gi;
const CN_THINKING_CORNER_REGEX = /【思考】[\s\S]*?【\/思考】/gi;

// Fenced code blocks: ```thinking, ```think, ```thoughts, ```reasoning, ```analysis
const THINK_FENCE_REGEX = /```(?:thinking|think|thoughts|reasoning|analysis)[\s\S]*?```/gi;

export interface ThinkingExtraction {
  hasThinking: boolean;
  thinking: string;
  answer: string;
}

export interface ThinkingNormalization {
  hasThinking: boolean;
  content: string;
  thinking: string;
  incomplete: boolean;
}

export function extractThinkingContent(text?: string | null): ThinkingExtraction {
  const source = text ?? '';
  if (!source) {
    return { hasThinking: false, thinking: '', answer: '' };
  }

  // 1. [[THINKING]]...[[/THINKING]] markers
  const startIndex = source.indexOf(THINKING_START_MARKER);
  const endIndex = source.indexOf(THINKING_END_MARKER);
  if (startIndex >= 0) {
    const thinkingStart = startIndex + THINKING_START_MARKER.length;
    const thinkingEnd = endIndex >= 0 ? endIndex : source.length;
    const thinking = source.slice(thinkingStart, thinkingEnd).trim();
    const answerStart = endIndex >= 0 ? endIndex + THINKING_END_MARKER.length : source.length;
    const answer = source.slice(answerStart).trimStart();
    return { hasThinking: true, thinking, answer };
  }

  // 2. XML-style tags: <think>, <thinking>, etc.
  const tagMatch = source.match(THINK_TAG_REGEX);
  if (tagMatch) {
    const thinking = tagMatch[0]
      .replace(/<\/?(?:think|thinking|thought|thoughts|reasoning|analysis)>/gi, '')
      .trim();
    const answer = source.replace(THINK_TAG_REGEX, '').trimStart();
    return { hasThinking: true, thinking, answer };
  }

  // 3. Chinese markers: [思考]...[/思考], 【思考】...【/思考】
  const cnSquareMatch = source.match(CN_THINKING_SQUARE_REGEX);
  if (cnSquareMatch) {
    const thinking = cnSquareMatch[0]
      .replace(/\[思考\]/g, '')
      .replace(/\[\/思考\]/g, '')
      .trim();
    const answer = source.replace(CN_THINKING_SQUARE_REGEX, '').trimStart();
    return { hasThinking: true, thinking, answer };
  }

  const cnCornerMatch = source.match(CN_THINKING_CORNER_REGEX);
  if (cnCornerMatch) {
    const thinking = cnCornerMatch[0]
      .replace(/【思考】/g, '')
      .replace(/【\/思考】/g, '')
      .trim();
    const answer = source.replace(CN_THINKING_CORNER_REGEX, '').trimStart();
    return { hasThinking: true, thinking, answer };
  }

  // 4. Fenced code blocks: ```thinking, ```think, etc.
  const fenceMatch = source.match(THINK_FENCE_REGEX);
  if (fenceMatch) {
    const thinking = fenceMatch[0]
      .replace(/```(?:thinking|think|thoughts|reasoning|analysis)/i, '')
      .replace(/```$/i, '')
      .trim();
    const answer = source.replace(THINK_FENCE_REGEX, '').trimStart();
    return { hasThinking: true, thinking, answer };
  }

  return { hasThinking: false, thinking: '', answer: source };
}

export function stripThinkingSegments(text?: string | null): string {
  return extractThinkingContent(text).answer.trim();
}

export function hasThinkingEnd(text: string): boolean {
  // Check for [[/THINKING]] marker
  if (text.includes(THINKING_END_MARKER)) {
    return true;
  }

  // Reset lastIndex before test() to avoid stateful regex issues
  THINK_TAG_REGEX.lastIndex = 0;
  if (THINK_TAG_REGEX.test(text)) {
    return true;
  }

  CN_THINKING_SQUARE_REGEX.lastIndex = 0;
  CN_THINKING_CORNER_REGEX.lastIndex = 0;
  if (CN_THINKING_SQUARE_REGEX.test(text) || CN_THINKING_CORNER_REGEX.test(text)) {
    return true;
  }

  THINK_FENCE_REGEX.lastIndex = 0;
  if (THINK_FENCE_REGEX.test(text)) {
    return true;
  }

  return false;
}

export function normalizeThinkingResult(
  content: string,
  providedThinking?: string
): ThinkingNormalization {
  const extracted = extractThinkingContent(content);

  // 即使有providedThinking，也要检查content中是否有新的thinking内容
  if (extracted.hasThinking) {
    if (!hasThinkingEnd(content)) {
      // 未闭合：全部当作思考，正文为空
      return {
        hasThinking: true,
        content: '',
        thinking: extracted.thinking,
        incomplete: true
      };
    }
    // 已闭合：分离思考和正文
    return {
      hasThinking: true,
      content: extracted.answer,
      thinking: extracted.thinking,
      incomplete: false
    };
  }

  // 没有thinking标记，如果有providedThinking则使用
  if (providedThinking) {
    return {
      hasThinking: true,
      content,
      thinking: providedThinking,
      incomplete: false
    };
  }

  return {
    hasThinking: false,
    content,
    thinking: '',
    incomplete: false
  };
}

/**
 * Streaming thinking parser
 * Incrementally extract thinking and content from streaming text chunks
 *
 * @example
 * const parser = new StreamingThinkingParser();
 * for (const chunk of stream) {
 *   const { thinking, content } = parser.append(chunk);
 *   if (thinking) onThinkingToken(thinking);
 *   if (content) onToken(content);
 * }
 * const final = parser.getResult();
 */
export class StreamingThinkingParser {
  private buffer = '';
  private thinking = '';
  private content = '';
  private inThinking = false;
  private thinkingMarker: string | null = null;

  /**
   * Append new chunk and extract thinking/content in real-time
   * @param {string} chunk New text chunk from stream
   * @return {Object} Extracted thinking and content from this chunk
   */
  append(chunk: string): { thinking: string; content: string } {
    this.buffer += chunk;
    let extractedThinking = '';
    let extractedContent = '';

    // Detect thinking start if not already in thinking mode
    if (!this.inThinking) {
      if (this.buffer.includes(THINKING_START_MARKER)) {
        this.inThinking = true;
        this.thinkingMarker = THINKING_START_MARKER;
        const startIndex = this.buffer.indexOf(THINKING_START_MARKER);
        extractedContent = this.buffer.slice(0, startIndex);
        this.buffer = this.buffer.slice(startIndex + THINKING_START_MARKER.length);
        this.content += extractedContent;
      } else if (/<(think|thinking|thought|thoughts|reasoning|analysis)>/i.test(this.buffer)) {
        const match = this.buffer.match(/<(think|thinking|thought|thoughts|reasoning|analysis)>/i);
        if (match) {
          this.inThinking = true;
          this.thinkingMarker = match[1];
          const startIndex = this.buffer.indexOf(match[0]);
          extractedContent = this.buffer.slice(0, startIndex);
          this.buffer = this.buffer.slice(startIndex + match[0].length);
          this.content += extractedContent;
        }
      } else if (/\[思考\]/i.test(this.buffer)) {
        this.inThinking = true;
        this.thinkingMarker = '[思考]';
        const startIndex = this.buffer.indexOf('[思考]');
        extractedContent = this.buffer.slice(0, startIndex);
        this.buffer = this.buffer.slice(startIndex + 4); // '[思考]'.length = 4
        this.content += extractedContent;
      } else if (/【思考】/i.test(this.buffer)) {
        this.inThinking = true;
        this.thinkingMarker = '【思考】';
        const startIndex = this.buffer.indexOf('【思考】');
        extractedContent = this.buffer.slice(0, startIndex);
        this.buffer = this.buffer.slice(startIndex + 4); // '【思考】'.length = 4
        this.content += extractedContent;
      } else if (/```(?:thinking|think|thoughts|reasoning|analysis)/i.test(this.buffer)) {
        const match = this.buffer.match(/```(thinking|think|thoughts|reasoning|analysis)/i);
        if (match) {
          this.inThinking = true;
          this.thinkingMarker = match[1];
          const startIndex = this.buffer.indexOf(match[0]);
          extractedContent = this.buffer.slice(0, startIndex);
          this.buffer = this.buffer.slice(startIndex + match[0].length);
          this.content += extractedContent;
        }
      } else {
        // No thinking marker found yet, treat as content (but keep buffer for partial match detection)
        const safeLength = Math.max(0, this.buffer.length - 20); // Keep last 20 chars for boundary detection
        if (safeLength > 0) {
          extractedContent = this.buffer.slice(0, safeLength);
          this.buffer = this.buffer.slice(safeLength);
          this.content += extractedContent;
        }
      }
    } else {
      // In thinking mode, check for end marker
      let endMarker = '';
      if (this.thinkingMarker === THINKING_START_MARKER) {
        endMarker = THINKING_END_MARKER;
      } else if (this.thinkingMarker === '[思考]') {
        endMarker = '[/思考]';
      } else if (this.thinkingMarker === '【思考】') {
        endMarker = '【/思考】';
      } else if (
        /^(think|thinking|thought|thoughts|reasoning|analysis)$/i.test(this.thinkingMarker || '')
      ) {
        endMarker = `</${this.thinkingMarker}>`;
      } else if (this.thinkingMarker) {
        endMarker = '```';
      }

      if (endMarker && this.buffer.includes(endMarker)) {
        const endIndex = this.buffer.indexOf(endMarker);
        extractedThinking = this.buffer.slice(0, endIndex);
        this.thinking += extractedThinking;
        this.buffer = this.buffer.slice(endIndex + endMarker.length);
        this.inThinking = false;
        this.thinkingMarker = null;
        // Continue processing remaining buffer as content
        const result = this.append('');
        return {
          thinking: extractedThinking,
          content: extractedContent + result.content
        };
      } else {
        // Still in thinking, accumulate (keep last 20 chars for boundary detection)
        const safeLength = Math.max(0, this.buffer.length - 20);
        if (safeLength > 0) {
          extractedThinking = this.buffer.slice(0, safeLength);
          this.buffer = this.buffer.slice(safeLength);
          this.thinking += extractedThinking;
        }
      }
    }

    return { thinking: extractedThinking, content: extractedContent };
  }

  /**
   * Get final accumulated thinking and content
   * Call this when stream ends to flush remaining buffer
   * @return {Object} Final thinking and content from the entire stream
   */
  getResult(): { thinking: string; content: string } {
    let finalContent = this.content;
    let finalThinking = this.thinking;

    // Flush remaining buffer
    if (this.inThinking) {
      finalThinking += this.buffer;
    } else {
      finalContent += this.buffer;
    }

    return {
      thinking: finalThinking,
      content: finalContent
    };
  }

  /**
   * Reset parser state for reuse
   */
  reset(): void {
    this.buffer = '';
    this.thinking = '';
    this.content = '';
    this.inThinking = false;
    this.thinkingMarker = null;
  }
}
