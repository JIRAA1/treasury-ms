const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const original = require.extensions['.ts']
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename)
const { calculateLateFine, formatFineDescription } = require('../src/lib/fine.ts')
const { sumMoney, tierBaseAmount, slipAmountMatches, isPositiveMoney } = require('../src/lib/money.ts')
const { generatePromptPayPayload } = require('../src/lib/promptpay.ts')
const { recentThaiMonths, thaiMonthKey } = require('../src/lib/report-dates.ts')
const { readAll } = require('../src/lib/read-all.ts')
const { resolveProfile } = require('../src/lib/supabase/resolve-profile.ts')
if (original) require.extensions['.ts'] = original
test('fine amount and explanation agree for legacy flat settings', () => {
  const period = { deadline: '2026-01-01T00:00:00+07:00', fine_type: 'flat', late_fine_amount: 10, fine_rate: 0 }
  assert.equal(calculateLateFine(period, new Date('2026-01-02')), 10)
  assert.match(formatFineDescription(period), /10/)
  assert.equal(calculateLateFine(period, new Date(period.deadline)), 0)
  assert.equal(calculateLateFine(period, new Date('2026-02-01'), true), 0)
})
test('daily fine respects grace and cap', () => {
  const p = { deadline: '2026-01-01T00:00:00+07:00', fine_type: 'daily', fine_rate: 5, fine_grace_days: 2, fine_cap: 12 }
  assert.equal(calculateLateFine(p, new Date('2026-01-03T00:00:00+07:00')), 0)
  assert.equal(calculateLateFine(p, new Date('2026-01-03T00:00:01+07:00')), 5)
  assert.equal(calculateLateFine(p, new Date('2026-02-01')), 12)
})
test('money totals and provider validation never accept missing amounts', () => {
  assert.equal(sumMoney([0.1, 0.2]), 0.3)
  assert.equal(tierBaseAmount(100, 1, 3), 33.33)
  assert.equal(slipAmountMatches(null, 50, true), false)
  assert.equal(slipAmountMatches(50, 50, false), false)
  assert.equal(slipAmountMatches(50, 50, null), true)
  for (const value of [-1, 0, NaN, Infinity, '50', 1.001]) assert.equal(isPositiveMoney(value), false)
})
function tlv(text) {
  const fields = {}
  for (let i = 0; i < text.length;) { const tag = text.slice(i, i+2); const length = Number(text.slice(i+2,i+4)); fields[tag] = text.slice(i+4,i+4+length); i += length + 4 }
  return fields
}
test('PromptPay encodes phone/tax identifiers and explicit amount correctly', () => {
  const phone = tlv(generatePromptPayPayload('081-234-5678', 12.34))
  assert.equal(phone['01'], '12')
  assert.equal(phone['54'], '12.34')
  assert.equal(tlv(phone['29'])['01'], '0066812345678')
  const tax = tlv(generatePromptPayPayload('1234567890123', 50))
  assert.equal(tlv(tax['29'])['02'], '1234567890123')
  assert.equal(tlv(generatePromptPayPayload('0812345678'))['01'], '11')
  for (const id of ['', 'hello', '123', '08123456789']) assert.throws(() => generatePromptPayPayload(id, 50))
  for (const amount of [0, -1, NaN, Infinity, 0.001]) assert.throws(() => generatePromptPayPayload('0812345678', amount))
})
test('month buckets do not overflow on the 31st and use Thailand timezone', () => {
  assert.deepEqual(recentThaiMonths(new Date('2026-03-31T12:00:00Z')).map(m => m.key), ['2025-10','2025-11','2025-12','2026-01','2026-02','2026-03'])
  assert.equal(thaiMonthKey('2026-01-31T18:00:00Z'), '2026-02')
  assert.equal(recentThaiMonths(new Date('2026-01-31T18:00:00Z'),1)[0].start, '2026-01-31T17:00:00.000Z')
})
test('financial reads include more than 1000 rows and propagate query failures', async () => {
  const rows=Array.from({length:1201},(_,id)=>({id}))
  const result=await readAll(async(from,to)=>({data:rows.slice(from,to+1),error:null}))
  assert.equal(result.data.length,1201)
  await assert.rejects(readAll(async()=>({data:null,error:{message:'Database unavailable'}})),/Database unavailable/)
})
test('user-editable metadata cannot impersonate a treasury administrator',async()=>{
  const filters=[]
  const client={from(){return {select(){return {eq(key,value){filters.push([key,value]);return {async maybeSingle(){return {data:null,error:null}}}}}}}}}
  const result=await resolveProfile(client,{id:'student-auth',user_metadata:{treasury_user_id:'admin-id',student_id:'admin-student'}})
  assert.equal(result,null)
  assert.deepEqual(filters,[['id','student-auth']])
})
