import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Sparkles, Heart, BookOpen, MessageCircle, MapPin, Phone } from 'lucide-react';
import type { Expression, GameState, Girl, Message } from '../types';
import { GirlPortrait } from './GirlPortrait';

type Burst = { key: string; role: Message['role']; items: Message[] };

function groupMessages(messages: Message[]): Burst[] {
  const groups: Burst[] = [];
  messages.forEach((message, index) => {
    const key = message.role === 'girl' && message.burstId ? message.burstId : `single-${index}`;
    const last = groups[groups.length - 1];
    if (key === last?.key && message.role === 'girl') last.items.push(message);
    else groups.push({ key, role: message.role, items: [message] });
  });
  return groups;
}

export function Conversation({ girl, state, onSend, remote = false, modelEnabled = false }: { girl: Girl; state: GameState; onSend: (text: string) => Promise<boolean>; remote?: boolean; modelEnabled?: boolean }) {
  const [text, setText] = useState('');
  const [memory, setMemory] = useState(false);
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState('');
  const [previewExpression, setPreviewExpression] = useState<Expression | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const stored = Object.hasOwn(state.messages, girl.id) ? state.messages[girl.id] : undefined;
  const messages = useMemo<Message[]>(() => Array.isArray(stored)
    ? stored
    : [{ role: 'girl' as const, text: `「所长，今晚想聊些什么？」${girl.name}为你留出了身边的位置。`, expression: 'smile' as const }], [stored, girl.name]);
  const expressionLabel: Record<Expression, string> = { calm: '平静', smile: '微笑', surprise: '惊讶', sad: '低落', angry: '生气', shy: '害羞' };
  const groups = useMemo(() => groupMessages(messages), [messages]);
  const latestExpression = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.role === 'girl' && messages[index]?.expression) return messages[index]!.expression!;
    }
    return girl.expression ?? 'calm';
  }, [messages, girl.expression]);
  const shownExpression = previewExpression ?? latestExpression;
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'instant', block: 'nearest' }); }, [messages.length, pending, sending]);
  const send = async (value: string) => {
    const clean = value.trim();
    if (!clean || sending) return;
    setSending(true); setPending(clean); setText('');
    const ok = await onSend(clean);
    setSending(false); setPending('');
    if (!ok) setText(clean);
  };
  return <div className="conversation">
    <div className="conversation-character" style={{ '--girl-color': girl.color } as React.CSSProperties}>
      <div className="conversation-orbit" />
      <GirlPortrait key={shownExpression} girl={{ ...girl, expression: shownExpression }} variant="full" />
      <div><span className="eyebrow">{remote ? '远程通话' : '今夜的片刻'}</span><h2>{girl.name}</h2><p>{girl.codename}</p><span className="conversation-bond"><Heart size={13} />羁绊 {girl.bond}</span>
          <span className="conversation-expression" id="conversation-expression">{expressionLabel[shownExpression]}</span></div>
    </div>
    <div className="conversation-main">
      <div className="conversation-heading"><div><MessageCircle size={17} /><b>灯下私语</b><span><MapPin size={12} />{remote ? '城南 · 家中' : state.rooms.find(room => room.id === girl.roomId)?.name}</span></div><button id="toggle-conversation-memory" className={`icon-btn ${memory ? 'selected' : ''}`} aria-pressed={memory} aria-label="查看对话记忆与场景上下文" onClick={() => setMemory(value => !value)}><BookOpen size={18} /></button></div>
      {remote && <div className="remote-banner"><Phone size={16} /><span><b>远程联络 · 手机</b><small>她退役后住在城南。每次通话 40 星砂，每日首次提升羁绊。手机那头有很轻的电流声。</small></span></div>}
      {memory && <div className="conversation-memory"><b>此刻的记忆</b><p>第 {state.day} 日夜间 · {girl.name} · {girl.element}<br />血量 {girl.hp} / {girl.maxHp} · 疲劳 {girl.fatigue} · 羁绊 {girl.bond} · 侵蚀 {girl.corruption ?? 0}</p><small>{modelEnabled ? '对话历史、最近委托、状态与关系会作为叙事者模型的上下文；模型只生成台词与动作，不改变数值。' : '对话历史与角色状态保存在本地。配置叙事者后，会作为模型上下文使用；当前使用本地剧情。'}</small></div>}
      <div className="chat-messages" role="log" aria-label="角色对话记录" aria-live="polite">
        {groups.map((group, groupIndex) => <div key={`${girl.id}-${group.key}`} className={`chat-burst ${group.role}`} style={{ '--burst-index': groupIndex } as React.CSSProperties}>
          <small>{group.role === 'player' ? '所长' : girl.name}</small>
          {group.items.map((message, index) => <div
            key={`${group.key}-${index}`}
            className={`chat-message ${message.role} ${message.action && !message.text ? 'action-only' : ''}`}
            style={{ '--line-index': index } as React.CSSProperties}
            onMouseEnter={message.role === 'girl' && message.expression ? () => setPreviewExpression(message.expression ?? null) : undefined}
            onMouseLeave={message.role === 'girl' ? () => setPreviewExpression(null) : undefined}
          >
            {message.text && <p className="chat-text">{message.text}</p>}
            {message.action && <p className="chat-action">{message.action}</p>}
          </div>)}
        </div>)}
        {pending && <div className="chat-burst player"><small>所长</small><div className="chat-message player pending"><p className="chat-text">{pending}</p></div></div>}
        {sending && <div className="chat-burst girl"><small>{girl.name}</small><div className="chat-message girl typing"><p className="chat-text"><i /><i /><i /><span>正在斟酌措辞</span></p></div></div>}
        <div ref={end} />
      </div>
      <div className="conversation-prompts">{['今晚的月亮有些不一样', '今天辛苦了，休息一下吧', '给你带了一颗糖'].map((prompt, index) => <button id={`chat-prompt-${index}`} key={prompt} disabled={sending} onClick={() => send(prompt)}>{prompt}</button>)}</div>
      <form className="chat-form" onSubmit={event => { event.preventDefault(); void send(text); }}><label className="sr-only" htmlFor="chat-input">对她说些什么</label><textarea id="chat-input" maxLength={500} rows={2} value={text} onChange={event => setText(event.target.value)} placeholder={sending ? '她正在回复……' : '写下你想对她说的话……'} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void send(text); } }} /><button id="chat-send" type="submit" disabled={!text.trim() || sending} aria-label="发送对话"><ArrowUp size={19} /></button></form>
      <div className="chat-footnote"><Sparkles size={11} /><span>{modelEnabled ? '叙事者模型生成 · 失败时回退本地剧情' : '本地剧情演示 · 配置叙事者后可接入模型'}</span><span>{text.length}/500</span></div>
    </div>
  </div>;
}
