import test from 'node:test';
import assert from 'node:assert/strict';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import {
  clearVertexToken,
  describeVertexCredential,
  isVertexServiceAccount,
  normalizeVertexModel,
  parseVertexServiceAccount,
  readVertexCredential,
  vertexAccessToken,
  vertexChat,
  vertexLocation,
  vertexTarget,
} from '../src/vertex.ts';

function serviceAccountJson(overrides: Record<string, unknown> = {}) {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
  return {
    pem,
    text: JSON.stringify({
      type: 'service_account',
      project_id: 'night-sugar-test',
      client_email: 'svc@night-sugar-test.iam.gserviceaccount.com',
      private_key: pem,
      token_uri: 'https://oauth2.googleapis.com/token',
      ...overrides,
    }),
  };
}

function decodeSegment(segment: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(segment.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) as Record<string, unknown>;
}

test('服务账号 JSON：认字段，缺字段就拒绝', () => {
  const { text } = serviceAccountJson();
  const parsed = parseVertexServiceAccount(text);
  assert.equal(parsed?.projectId, 'night-sugar-test');
  assert.equal(parsed?.clientEmail, 'svc@night-sugar-test.iam.gserviceaccount.com');
  assert.equal(parsed?.tokenUri, 'https://oauth2.googleapis.com/token');

  assert.equal(parseVertexServiceAccount('{}'), null);
  assert.equal(parseVertexServiceAccount('{"project_id":"p"}'), null);
  assert.equal(parseVertexServiceAccount('sk-not-json'), null);
  assert.equal(parseVertexServiceAccount(''), null);
  assert.equal(isVertexServiceAccount(text), true);
  assert.equal(isVertexServiceAccount('AIzaSy-express'), false);
});

test('凭证类型：JSON 走服务账号，其它非 JSON 当 Express 密钥', () => {
  const { text } = serviceAccountJson();
  assert.equal(readVertexCredential(text)?.kind, 'service-account');
  assert.equal(readVertexCredential('AIzaSy-express')?.kind, 'express-key');
  assert.equal(readVertexCredential('   '), null);
  assert.equal(readVertexCredential('{"project_id":"p"}'), null);
});

test('模型名去掉各种前缀后再拼路径', () => {
  assert.equal(normalizeVertexModel('gemini-2.5-pro'), 'gemini-2.5-pro');
  assert.equal(normalizeVertexModel('models/gemini-2.5-pro'), 'gemini-2.5-pro');
  assert.equal(normalizeVertexModel('publishers/google/models/gemini-2.5-flash'), 'gemini-2.5-flash');
  assert.equal(normalizeVertexModel('google/gemini-2.5-pro'), 'gemini-2.5-pro');
  assert.equal(normalizeVertexModel('gemini-2.5-pro:generateContent'), 'gemini-2.5-pro');
  assert.equal(normalizeVertexModel('  gemini-2.0-flash  '), 'gemini-2.0-flash');
});

test('端点：服务账号按区域拼主机，global 去掉前缀，Express 带 key', () => {
  const sa = { projectId: 'proj', clientEmail: 'a@b', privateKey: '', tokenUri: '' };
  assert.equal(
    vertexTarget({ model: 'gemini-2.5-pro', location: 'asia-east1' }, sa).url,
    'https://asia-east1-aiplatform.googleapis.com/v1/projects/proj/locations/asia-east1/publishers/google/models/gemini-2.5-pro:generateContent',
  );
  assert.equal(
    vertexTarget({ model: 'gemini-2.5-pro', location: 'global' }, sa).url,
    'https://aiplatform.googleapis.com/v1/projects/proj/locations/global/publishers/google/models/gemini-2.5-pro:generateContent',
  );
  assert.equal(vertexTarget({ model: 'gemini-2.5-pro' }, sa).url.includes('us-central1-aiplatform.googleapis.com'), true);
  const express = vertexTarget({ model: 'gemini-2.0-flash', expressKey: 'AIza secret' });
  assert.equal(express.url, 'https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.0-flash:generateContent?key=AIza%20secret');
  assert.equal(express.display.includes('key='), false);
  assert.equal(vertexLocation(''), 'us-central1');
  assert.equal(vertexLocation('  europe-west4 '), 'europe-west4');
});

test('服务账号签名：断言可被公钥验签，claims 齐全', async () => {
  const { text, pem } = serviceAccountJson();
  const calls: { url: string; body: string }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: String(init?.body ?? '') });
    return new Response(JSON.stringify({ access_token: 'token-abc', expires_in: 3600 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    clearVertexToken();
    const result = await vertexAccessToken(parseVertexServiceAccount(text)!);
    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://oauth2.googleapis.com/token');
    const params = new URLSearchParams(calls[0].body);
    assert.equal(params.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
    const assertion = params.get('assertion') ?? '';
    const [header, claims, signature] = assertion.split('.');
    assert.deepEqual(decodeSegment(header), { alg: 'RS256', typ: 'JWT' });
    const payload = decodeSegment(claims);
    assert.equal(payload.iss, 'svc@night-sugar-test.iam.gserviceaccount.com');
    assert.equal(payload.scope, 'https://www.googleapis.com/auth/cloud-platform');
    assert.equal(payload.aud, 'https://oauth2.googleapis.com/token');
    assert.equal(Number(payload.exp) - Number(payload.iat), 3600);
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${header}.${claims}`);
    assert.equal(verifier.verify(pem, Buffer.from(signature.replace(/-/g, '+').replace(/_/g, '/'), 'base64')), true);

    // 第二次直接吃缓存，不再打认证端点。
    const again = await vertexAccessToken(parseVertexServiceAccount(text)!);
    assert.equal(again.ok, true);
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = original;
    clearVertexToken();
  }
});

test('token 端点报错时给出可读提示', async () => {
  const { text } = serviceAccountJson();
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid JWT Signature.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
  try {
    clearVertexToken();
    const result = await vertexAccessToken(parseVertexServiceAccount(text)!);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /换取访问令牌失败（400）/);
      assert.match(result.message, /Invalid JWT Signature/);
    }
  } finally {
    globalThis.fetch = original;
    clearVertexToken();
  }
});

test('generateContent：system 抽出去，assistant 映射成 model，图片转 inlineData', async () => {
  const { text } = serviceAccountJson();
  const sent: { url: string; payload: Record<string, unknown>; auth?: string }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    if (String(url).includes('oauth2.googleapis.com')) {
      return new Response(JSON.stringify({ access_token: 'token-xyz', expires_in: 3600 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    sent.push({ url: String(url), payload: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>, auth: headers.Authorization });
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '想好了。' }, { text: '先冷静。', thought: true }] }, finishReason: 'MAX_TOKENS' }],
      usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 34, totalTokenCount: 46 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    clearVertexToken();
    const result = await vertexChat(
      { model: 'publishers/google/models/gemini-2.5-pro', location: 'asia-east1', secret: text },
      [
        { role: 'system', content: '你是守夜人。' },
        { role: 'user', content: [{ type: 'text', text: '看这张图' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } }] },
        { role: 'assistant', content: '嗯。' },
      ],
      { temperature: 0.4, maxTokens: 256, topP: 0.9 },
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.text, '想好了。');
      assert.equal(result.reasoning, '先冷静。');
      assert.equal(result.finish, 'length');
      assert.deepEqual(result.usage, { prompt: 12, completion: 34, total: 46 });
    }
    assert.equal(sent.length, 1);
    assert.match(sent[0].url, /asia-east1-aiplatform\.googleapis\.com\/v1\/projects\/night-sugar-test\/locations\/asia-east1\/publishers\/google\/models\/gemini-2\.5-pro:generateContent$/);
    assert.equal(sent[0].auth, 'Bearer token-xyz');
    const payload = sent[0].payload as {
      systemInstruction: { parts: { text: string }[] };
      contents: { role: string; parts: Record<string, unknown>[] }[];
      generationConfig: Record<string, number>;
    };
    assert.equal(payload.systemInstruction.parts[0].text, '你是守夜人。');
    assert.deepEqual(payload.contents.map(item => item.role), ['user', 'model']);
    assert.deepEqual(payload.contents[0].parts[1], { inlineData: { mimeType: 'image/png', data: 'AAAA' } });
    assert.equal(payload.generationConfig.maxOutputTokens, 256);
    assert.equal(payload.generationConfig.temperature, 0.4);
    assert.equal(payload.generationConfig.topP, 0.9);
  } finally {
    globalThis.fetch = original;
    clearVertexToken();
  }
});

test('generateContent 失败：403 指向权限，安全拦截单独说明', async () => {
  const { text } = serviceAccountJson();
  const original = globalThis.fetch;
  let mode: 'forbidden' | 'blocked' = 'forbidden';
  globalThis.fetch = (async (url: string | URL | Request) => {
    if (String(url).includes('oauth2.googleapis.com')) {
      return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (mode === 'forbidden') {
      return new Response(JSON.stringify({ error: { code: 403, message: 'Permission denied on resource project.' } }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    clearVertexToken();
    const denied = await vertexChat({ model: 'gemini-2.5-pro', secret: text }, [{ role: 'user', content: 'hi' }]);
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.match(denied.message, /返回 403/);
      assert.match(denied.message, /roles\/aiplatform\.user/);
    }
    mode = 'blocked';
    const blocked = await vertexChat({ model: 'gemini-2.5-pro', secret: text }, [{ role: 'user', content: 'hi' }]);
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.match(blocked.message, /安全策略拦截（SAFETY）/);
  } finally {
    globalThis.fetch = original;
    clearVertexToken();
  }
});

test('设置页诊断：能区分空、服务账号、Express 与坏 JSON', () => {
  const { text } = serviceAccountJson();
  assert.equal(describeVertexCredential('').kind, 'empty');
  const sa = describeVertexCredential(text);
  assert.equal(sa.kind, 'service-account');
  assert.equal(sa.projectId, 'night-sugar-test');
  assert.equal(describeVertexCredential('AIza-key').kind, 'express-key');
  const broken = describeVertexCredential('{"client_email":"a@b"}');
  assert.equal(broken.kind, 'invalid');
  assert.match(broken.message, /缺少 project_id/);
});
