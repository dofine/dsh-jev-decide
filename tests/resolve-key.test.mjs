/**
 * resolveKey 的优先级与容错测试，外加一次带 fetch 桩的端到端检查：
 * 插件真的把凭证缝解析出的值放进了 Authorization 头。
 *
 * 运行：node --test tests
 */
import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { apply, resolveKey } from '../lib/index.js'

const REF = 'TYPESAFE_AI_API_KEY'
const originalEnv = process.env.TYPESAFE_API_KEY

afterEach(() => {
	if (originalEnv === undefined) delete process.env.TYPESAFE_API_KEY
	else process.env.TYPESAFE_API_KEY = originalEnv
})

/** 凭证缝替身，记录被请求的 ref。 */
function credentialsStub(result) {
	const asked = []
	return {
		asked,
		async resolve(ref) {
			asked.push(ref)
			if (result instanceof Error) throw result
			return result
		},
	}
}

describe('resolveKey 优先级', () => {
	it('config.apiKey 最高优先', async () => {
		process.env.TYPESAFE_API_KEY = 'from-env'
		const credentials = credentialsStub({ value: 'from-seam', source: 'file' })
		assert.equal(await resolveKey({ apiKey: 'from-config' }, credentials), 'from-config')
		assert.deepEqual(credentials.asked, [])
	})

	it('config.apiKey 为空白时继续往下走', async () => {
		process.env.TYPESAFE_API_KEY = 'from-env'
		assert.equal(await resolveKey({ apiKey: '   ' }, credentialsStub({ value: 'x' })), 'from-env')
	})

	it('环境变量优先于凭证缝', async () => {
		process.env.TYPESAFE_API_KEY = 'from-env'
		const credentials = credentialsStub({ value: 'from-seam', source: 'file' })
		assert.equal(await resolveKey({}, credentials), 'from-env')
		assert.deepEqual(credentials.asked, [])
	})

	it('前两层都空时用凭证缝，并按 ref 名请求', async () => {
		delete process.env.TYPESAFE_API_KEY
		const credentials = credentialsStub({ value: 'from-seam', source: 'file' })
		assert.equal(await resolveKey({}, credentials), 'from-seam')
		assert.deepEqual(credentials.asked, [REF])
	})

	it('去掉凭证值两侧空白', async () => {
		delete process.env.TYPESAFE_API_KEY
		assert.equal(await resolveKey({}, credentialsStub({ value: '  from-seam\n', source: 'file' })), 'from-seam')
	})
})

describe('resolveKey 容错', () => {
	it('未挂载凭证缝 → undefined', async () => {
		delete process.env.TYPESAFE_API_KEY
		assert.equal(await resolveKey({}, undefined), undefined)
	})

	it('凭证缝未配置该 ref → undefined', async () => {
		delete process.env.TYPESAFE_API_KEY
		assert.equal(await resolveKey({}, credentialsStub(undefined)), undefined)
	})

	it('凭证缝返回空白值 → undefined', async () => {
		delete process.env.TYPESAFE_API_KEY
		assert.equal(await resolveKey({}, credentialsStub({ value: '   ', source: 'file' })), undefined)
	})

	it('凭证缝抛错 → undefined（交给调用方报可读错误）', async () => {
		delete process.env.TYPESAFE_API_KEY
		assert.equal(await resolveKey({}, credentialsStub(new Error('凭证文档损坏'))), undefined)
	})
})

describe('工具执行时使用解析出的密钥', () => {
	it('把凭证缝的值放进 Authorization 头', async () => {
		delete process.env.TYPESAFE_API_KEY
		let definition
		const ctx = {
			tools: { register: (value) => { definition = value } },
			get: (name) => (name === 'credentials' ? credentialsStub({ value: 'seam-key', source: 'file' }) : undefined),
		}
		const requests = []
		const originalFetch = globalThis.fetch
		globalThis.fetch = async (url, init) => {
			requests.push({ url, authorization: init.headers.authorization, body: JSON.parse(init.body) })
			return {
				ok: true,
				status: 200,
				json: async () => ({ model: 'jev-1.13.0', answers: { decision: { type: 'noul', noul: 0.9 } }, usage: {} }),
			}
		}
		try {
			await apply(ctx, {})
			const value = await definition.execute(
				{ state: 'hello', question: 'Is this a greeting?', type: 'noul' },
				{ signal: new AbortController().signal },
			)
			assert.equal(value.answer, 0.9)
			assert.equal(requests.length, 1)
			assert.equal(requests[0].authorization, 'Bearer seam-key')
			assert.equal(requests[0].body.model, 'jev-latest')
		} finally {
			globalThis.fetch = originalFetch
		}
	})
})
