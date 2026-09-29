const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { PGlite } = require('@electric-sql/pglite')
const db = new PGlite()
const uid = n => '00000000-0000-4000-8000-' + String(n).padStart(12,'0')
const student = uid(1), admin = uid(2), other = uid(3), semester = uid(10), collection = uid(20)
async function scalar(sql, args=[]) { return (await db.query(sql,args)).rows[0] }
async function rpc(name,args) { return (await scalar('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') as result',args)).result }
const row = (period, extra={}) => ({ period_id: uid(period), amount:50, status:'pending', ...extra })
before(async () => {
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid, email text, email_confirmed_at timestamptz); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;")
  const schema = fs.readFileSync('supabase_schema.sql','utf8')
  const tables = [...schema.matchAll(/CREATE TABLE public\.(\w+)\s*\([\s\S]*?\n\);/g)]
  const order = ['users','semesters','periods','payments','expenses','audit_logs','notifications','system_settings','incomes','payment_credits','special_collections','special_collection_items','special_collection_slips']
  for (const name of order) await db.exec(tables.find(t=>t[1]===name)[0])
  const migration = fs.readFileSync('migration_payment_integrity.sql','utf8')
  try { await db.exec(migration) } catch (e) { console.error('Migration SQL error', e.message, e.position, e.internalPosition, e.internalQuery); throw e }
  await db.exec(migration) // deployment retry must be safe
  await db.query("insert into users(id,student_id,fullname,role) values($1,'00000001','Student','student'),($2,'00000002','Admin','admin'),($3,'00000003','Other','student')",[student,admin,other])
  await db.query("insert into semesters(id,name,is_active) values($1,'Test',true)",[semester])
  for(let i=100;i<120;i++) await db.query("insert into periods(id,semester_id,label,period_order,deadline,amount) values($1,$2,$3,$4,now()+interval '1 day',50)",[uid(i),semester,'Period '+i,i])
  await db.query("insert into special_collections(id,title,default_amount,allow_installments,max_installments) values($1,'Shirt',100,true,2)",[collection])
  await db.query("insert into special_collection_items(id,collection_id,user_id,amount) values($1,$2,$3,100),($4,$2,$5,100)",[uid(30),collection,student,uid(31),other])
})
after(async()=>db.close())
test('batch payment rolls back all rows when any selected period conflicts', async()=>{
  await rpc('save_regular_payments',[student,JSON.stringify([row(100)]),null])
  await assert.rejects(rpc('save_regular_payments',[student,JSON.stringify([row(101),row(100)]),null]),/PAYMENT_EXISTS/)
  assert.equal((await scalar('select count(*)::int as n from payments where period_id=$1',[uid(101)])).n,0)
})
test('manual combined payment saves every allocation with common evidence', async()=>{
  const result=await rpc('save_regular_payments',[student,JSON.stringify([row(101,{slip_url:'shared',file_hash:'manual1'}),row(102,{slip_url:'shared',file_hash:'manual2'})]),null])
  assert.equal(result.length,2)
  assert.equal(result.reduce((n,p)=>n+Number(p.amount),0),100)
  assert.ok(result.every(p=>p.status==='pending' && p.slip_url==='shared'))
})
test('cash validates amount and resolves credit atomically', async()=>{
  await assert.rejects(rpc('save_regular_payments',[student,JSON.stringify([row(103,{amount:-1,status:'approved'})]),admin]),/INVALID_AMOUNT/)
  await db.query("insert into payment_credits(user_id,period_id,amount) values($1,$2,50)",[student,uid(103)])
  const result=await rpc('save_regular_payments',[student,JSON.stringify([row(103,{status:'approved'})]),admin])
  const credit=await scalar('select status,repaid_via from payment_credits where period_id=$1',[uid(103)])
  assert.equal(credit.status,'repaid'); assert.equal(credit.repaid_via,result[0].id)
})
test('regular approval preserves received amount, retry is unchanged, rejection retains evidence', async()=>{
  const [p]=await rpc('save_regular_payments',[student,JSON.stringify([row(104,{amount:60,slip_url:'evidence'})]),null])
  const first=await rpc('review_regular_payment',[p.id,admin,'approve',null,null])
  assert.equal(Number(first.payment.amount),60)
  assert.equal((await rpc('review_regular_payment',[p.id,admin,'approve',null,null])).unchanged,true)
  const rejected=await rpc('review_regular_payment',[p.id,admin,'reject',null,'test'])
  assert.equal(rejected.payment.slip_url,'evidence')
})
test('installment limit is enforced and invalid upload does not lock payment mode', async()=>{
  await assert.rejects(rpc('save_special_slip',[student,collection,uid(30),'installment',100,JSON.stringify({amount:1,slip_url:'test'})]),/INVALID_INSTALLMENTS/)
  assert.equal((await scalar('select payment_mode from special_collection_items where id=$1',[uid(30)])).payment_mode,null)
})
test('special approval is idempotent and cannot silently reverse approved history', async()=>{
  const slip=await rpc('save_special_slip',[student,collection,uid(30),'installment',2,JSON.stringify({amount:50,slip_url:'test',trans_ref:'special-ref',file_hash:'special-hash'})])
  await assert.rejects(rpc('save_special_slip',[student,collection,uid(30),'installment',2,JSON.stringify({amount:50,slip_url:'test2'})]),/PAYMENT_EXISTS/)
  await rpc('review_special_slip',[slip.id,admin,'approve',null])
  const retry=await rpc('review_special_slip',[slip.id,admin,'approve',null])
  assert.equal(retry.unchanged,true)
  assert.equal(Number((await scalar('select paid_amount from special_collection_items where id=$1',[uid(30)])).paid_amount),50)
  assert.equal((await scalar('select count(*)::int as n from incomes where special_slip_id=$1',[slip.id])).n,1)
  await assert.rejects(rpc('review_special_slip',[slip.id,admin,'reject','test']),/INVALID_TRANSITION/)
})
test('cross-system duplicate transfer and file are rejected by database',async()=>{
  await assert.rejects(rpc('save_regular_payments',[student,JSON.stringify([row(105,{trans_ref:'special-ref'})]),null]),/DUPLICATE_SLIP/)
  await assert.rejects(rpc('save_regular_payments',[student,JSON.stringify([row(105,{file_hash:'special-hash'})]),null]),/DUPLICATE_SLIP/)
})
test('approval failure rolls back slip and paid amount together',async()=>{
  const slip=await rpc('save_special_slip',[student,collection,uid(30),'installment',2,JSON.stringify({amount:50,slip_url:'second'})])
  await db.exec("CREATE FUNCTION fail_income() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SIMULATED_FAILURE'; END $$; CREATE TRIGGER fail_income BEFORE INSERT ON incomes FOR EACH ROW EXECUTE FUNCTION fail_income();")
  await assert.rejects(rpc('review_special_slip',[slip.id,admin,'approve',null]),/SIMULATED_FAILURE/)
  assert.equal((await scalar('select status from special_collection_slips where id=$1',[slip.id])).status,'pending')
  assert.equal(Number((await scalar('select paid_amount from special_collection_items where id=$1',[uid(30)])).paid_amount),50)
  await db.exec('DROP TRIGGER fail_income ON incomes')
})
test('authenticated clients cannot mutate special records or call financial RPCs',async()=>{
  assert.equal((await scalar("select has_table_privilege('authenticated','special_collection_items','UPDATE') as allowed")).allowed,false)
  assert.equal((await scalar("select has_function_privilege('authenticated','save_regular_payments(uuid,jsonb,uuid)','EXECUTE') as allowed")).allowed,false)
  assert.equal((await scalar("select has_function_privilege('authenticated','review_special_slip(uuid,uuid,text,text)','EXECUTE') as allowed")).allowed,false)
})
test('student RLS reads only own assigned items and rejects direct writes',async()=>{
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'00000001@treasury.local',now())",[student])
  await db.exec('GRANT SELECT ON users,special_collection_items,special_collection_slips,special_collections TO authenticated; GRANT USAGE ON SCHEMA public,auth TO authenticated;')
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[student])
  await db.exec('SET ROLE authenticated')
  try {
    const result=await db.query('select user_id from special_collection_items')
    assert.equal(result.rows.length,1)
    assert.equal(result.rows[0].user_id,student)
    await assert.rejects(db.query("update special_collection_items set paid_amount=100"),/permission denied/)
  } finally { await db.exec('RESET ROLE') }
})
test('new incomes receive active semester while historical rows are not guessed',async()=>{
  const r=await scalar("insert into incomes(title,amount) values('ordinary',20) returning semester_id")
  assert.equal(r.semester_id,semester)
})
test('verified credit auto-approval requires a pending credit for that exact period',async()=>{
  await assert.rejects(rpc('save_regular_payments',[student,JSON.stringify([row(106,{status:'approved',verified_by_api:true})]),null]),/ADMIN_REQUIRED/)
  await db.query('insert into payment_credits(user_id,period_id,amount) values($1,$2,50)',[student,uid(106)])
  const [payment]=await rpc('save_regular_payments',[student,JSON.stringify([row(106,{status:'approved',verified_by_api:true})]),null])
  assert.equal(payment.status,'approved')
  assert.equal((await scalar('select status from payment_credits where period_id=$1',[uid(106)])).status,'repaid')
})
test('rejecting a main row does not permit reuse while an approved carry allocation exists',async()=>{
  const rows=await rpc('save_regular_payments',[student,JSON.stringify([row(107,{trans_ref:'group-transfer'}),row(108,{trans_ref:'group-transfer_carry_'+uid(108)})]),null])
  await rpc('review_regular_payment',[rows[1].id,admin,'approve',null,null])
  await rpc('review_regular_payment',[rows[0].id,admin,'reject',null,'test'])
  await assert.rejects(rpc('save_regular_payments',[student,JSON.stringify([row(107,{trans_ref:'group-transfer'})]),null]),/DUPLICATE_SLIP/)
})
