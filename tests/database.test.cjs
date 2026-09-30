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
  const corrections = fs.readFileSync('migration_special_corrections.sql','utf8')
  await db.exec(corrections)
  await db.exec(corrections)
  const cash = fs.readFileSync('migration_special_cash.sql','utf8')
  await db.exec(cash)
  await db.exec(cash)
  await db.query("insert into users(id,student_id,fullname,role) values($1,'00000001','Student','student'),($2,'00000002','Admin','admin'),($3,'00000003','Other','student')",[student,admin,other])
  await db.query("insert into semesters(id,name,is_active) values($1,'Test',true)",[semester])
  for(let i=100;i<120;i++) await db.query("insert into periods(id,semester_id,label,period_order,deadline,amount) values($1,$2,$3,$4,now()+interval '1 day',50)",[uid(i),semester,'Period '+i,i])
  await db.query("insert into special_collections(id,title,default_amount,allow_installments,max_installments) values($1,'Shirt',100,true,2)",[collection])
  await db.query("insert into special_collection_items(id,collection_id,user_id,amount) values($1,$2,$3,100),($4,$2,$5,100)",[uid(30),collection,student,uid(31),other])
})
after(async()=>db.close())
test('cash full payment writes one income and retries never double count',async()=>{
  await db.exec('BEGIN')
  try {
    const args=[uid(31),admin,uid(901),100,'full',1,0,'Paid in class']
    await rpc('record_special_cash',args)
    assert.equal((await rpc('record_special_cash',args)).unchanged,true)
    const item=await scalar('select * from special_collection_items where id=$1',[uid(31)])
    assert.equal(item.status,'approved'); assert.equal(Number(item.paid_amount),100)
    assert.equal(item.payment_mode,'full'); assert.equal(item.chosen_installments,1)
    const receipt=await scalar('select * from special_collection_slips where id=$1',[uid(901)])
    assert.equal(receipt.payment_method,'cash'); assert.equal(receipt.slip_url,null)
    assert.equal(receipt.verified_by,admin); assert.equal(receipt.payment_note,'Paid in class')
    const income=await scalar('select count(*)::int as n,sum(amount) as total from incomes where special_slip_id=$1',[uid(901)])
    assert.equal(income.n,1); assert.equal(Number(income.total),100)
    await rpc('correct_special_item',[uid(31),admin,'full',1,JSON.stringify([{id:uid(901),amount:100,status:'rejected'}]),JSON.stringify(await correctionSnapshot(uid(31))),'Entered cash for wrong student'])
    assert.equal((await scalar('select status from special_collection_items where id=$1',[uid(31)])).status,'unpaid')
    assert.equal((await scalar('select count(*)::int as n from incomes where special_slip_id=$1',[uid(901)])).n,0)
  } finally { await db.exec('ROLLBACK') }
})

test('cash installments allow actual partial amounts and later transfer payoff',async()=>{
  await db.exec('BEGIN')
  try {
    await rpc('record_special_cash',[uid(31),admin,uid(902),30,'installment',2,0,null])
    let item=await scalar('select * from special_collection_items where id=$1',[uid(31)])
    assert.equal(item.status,'partial'); assert.equal(item.payment_mode,'installment')
    assert.equal(Number(item.paid_amount),30)
    await rpc('record_special_cash',[uid(31),admin,uid(903),20,'installment',2,30,null])
    const slip=await rpc('save_special_slip',[other,collection,uid(31),'installment',2,JSON.stringify({amount:50,is_payoff:true,slip_url:'transfer-payoff'})])
    await rpc('review_special_slip',[slip.id,admin,'approve',null])
    item=await scalar('select * from special_collection_items where id=$1',[uid(31)])
    assert.equal(item.status,'approved'); assert.equal(Number(item.paid_amount),100)
    assert.equal((await scalar('select payment_method from special_collection_slips where id=$1',[slip.id])).payment_method,'transfer')
    assert.equal(Number((await scalar('select sum(amount) as total from incomes where special_slip_id in (select id from special_collection_slips where item_id=$1)',[uid(31)])).total),100)
  } finally { await db.exec('ROLLBACK') }
})

test('cash rejects invalid, stale or pending payments and rolls back on income failure',async()=>{
  await db.exec('BEGIN')
  try {
    const args=[uid(31),admin,uid(904),100,'full',1,0,null]
    for (const [changes,pattern] of [[{1:other},/ADMIN_REQUIRED/],[{3:0},/INVALID_AMOUNT/],[{3:1.111},/INVALID_AMOUNT/],[{3:101},/OVERPAYMENT/],[{3:50},/FULL_AMOUNT_REQUIRED/],[{4:'installment',5:3},/INVALID_INSTALLMENTS/],[{6:50},/STALE_DATA/]]) {
      await db.exec('SAVEPOINT cash_validation')
      await assert.rejects(rpc('record_special_cash',Object.assign([...args],changes)),pattern)
      await db.exec('ROLLBACK TO SAVEPOINT cash_validation')
      assert.equal((await scalar('select count(*)::int as n from special_collection_slips where item_id=$1',[uid(31)])).n,0)
    }
    await db.exec("CREATE FUNCTION fail_cash_income() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'CASH_INCOME_FAILURE'; END $$; CREATE TRIGGER fail_cash_income BEFORE INSERT ON incomes FOR EACH ROW EXECUTE FUNCTION fail_cash_income(); SAVEPOINT cash_failure;")
    await assert.rejects(rpc('record_special_cash',args),/CASH_INCOME_FAILURE/)
    await db.exec('ROLLBACK TO SAVEPOINT cash_failure; DROP TRIGGER fail_cash_income ON incomes')
    assert.equal((await scalar('select count(*)::int as n from special_collection_slips where item_id=$1',[uid(31)])).n,0)
    assert.equal((await scalar('select payment_mode from special_collection_items where id=$1',[uid(31)])).payment_mode,null)
    await db.query('update special_collections set allow_installments=false where id=$1',[collection])
    await db.exec('SAVEPOINT disabled_installments')
    await assert.rejects(rpc('record_special_cash',[uid(31),admin,uid(904),50,'installment',2,0,null]),/INVALID_INSTALLMENTS/)
    await db.exec('ROLLBACK TO SAVEPOINT disabled_installments')
    await rpc('save_special_slip',[other,collection,uid(31),'full',1,JSON.stringify({amount:100,slip_url:'pending-transfer'})])
    await db.exec('SAVEPOINT pending')
    await assert.rejects(rpc('record_special_cash',args),/PENDING_SLIP/)
    await db.exec('ROLLBACK TO SAVEPOINT pending')
    assert.equal((await scalar("select has_function_privilege('authenticated','record_special_cash(uuid,uuid,uuid,numeric,text,integer,numeric,text)','EXECUTE') as allowed")).allowed,false)
  } finally { await db.exec('ROLLBACK') }
})

async function correctionSnapshot(itemId) {
  const item = await scalar('select * from special_collection_items where id=$1',[itemId])
  const slips = (await db.query('select id,amount,status from special_collection_slips where item_id=$1 order by id',[itemId])).rows
  return { payment_mode:item.payment_mode, chosen_installments:item.chosen_installments, amount:Number(item.amount), paid_amount:Number(item.paid_amount), slips:slips.map(s=>({...s,amount:Number(s.amount)})) }
}

test('manual correction changes installment to full, adjusts income, reverses approval and rejects stale writes',async()=>{
  await db.exec('BEGIN')
  try {
    const slip=await rpc('save_special_slip',[other,collection,uid(31),'installment',2,JSON.stringify({amount:50,slip_url:'correction'})])
    await rpc('review_special_slip',[slip.id,admin,'approve',null])
    const expected=await correctionSnapshot(uid(31))
    const changed=[{id:slip.id,amount:100,status:'approved'}]
    const args=[uid(31),admin,'full',1,JSON.stringify(changed),JSON.stringify(expected),'Actually paid in full']
    await rpc('correct_special_item',args)
    const item=await scalar('select * from special_collection_items where id=$1',[uid(31)])
    assert.equal(item.payment_mode,'full'); assert.equal(item.chosen_installments,1)
    assert.equal(Number(item.paid_amount),100); assert.equal(item.status,'approved')
    assert.equal(Number((await scalar('select amount from incomes where special_slip_id=$1',[slip.id])).amount),100)
    assert.equal((await scalar('select verified_by_api from special_collection_slips where id=$1',[slip.id])).verified_by_api,false)
    await db.exec('SAVEPOINT stale')
    await assert.rejects(rpc('correct_special_item',args),/STALE_DATA/)
    await db.exec('ROLLBACK TO SAVEPOINT stale')
    await rpc('correct_special_item',[uid(31),admin,'full',1,JSON.stringify([{...changed[0],status:'pending'}]),JSON.stringify(await correctionSnapshot(uid(31))),'Mistaken approval'])
    assert.equal((await scalar('select status from special_collection_items where id=$1',[uid(31)])).status,'pending')
    assert.equal(Number((await scalar('select paid_amount from special_collection_items where id=$1',[uid(31)])).paid_amount),0)
    assert.equal((await scalar('select count(*)::int as n from incomes where special_slip_id=$1',[slip.id])).n,0)
    const audit=await scalar("select old_value from audit_logs where action='special_item_corrected' and old_value->'item'->>'payment_mode'='full'")
    assert.equal(audit.old_value.incomes.length,1)
    assert.equal(audit.old_value.slips[0].slip_url,'correction')
    await rpc('review_special_slip',[slip.id,admin,'approve',null])
    assert.equal((await scalar('select count(*)::int as n from incomes where special_slip_id=$1',[slip.id])).n,1)
  } finally { await db.exec('ROLLBACK') }
})

test('manual correction enforces permissions, reason, amount, and atomic rollback',async()=>{
  await db.exec('BEGIN')
  try {
    const slip=await rpc('save_special_slip',[other,collection,uid(31),'full',1,JSON.stringify({amount:100,slip_url:'validation'})])
    const expected=JSON.stringify(await correctionSnapshot(uid(31)))
    const args=[uid(31),admin,'full',1,JSON.stringify([{id:slip.id,amount:100,status:'approved'}]),expected,'Fix']
    for (const [changes,pattern] of [[{1:other},/ADMIN_REQUIRED/],[{6:' '},/REASON_REQUIRED/],[{4:JSON.stringify([{id:slip.id,amount:101,status:'approved'}])},/OVERPAYMENT/],[{4:JSON.stringify([{id:slip.id,amount:-1,status:'approved'}])},/INVALID_AMOUNT/],[{4:'[]'},/INVALID_SLIPS/],[{2:'installment',3:3},/INVALID_INSTALLMENTS/]]) {
      await db.exec('SAVEPOINT validation')
      await assert.rejects(rpc('correct_special_item',Object.assign([...args],changes)),pattern)
      await db.exec('ROLLBACK TO SAVEPOINT validation')
      assert.equal((await scalar('select status from special_collection_slips where id=$1',[slip.id])).status,'pending')
      assert.equal((await scalar('select count(*)::int as n from incomes where special_slip_id=$1',[slip.id])).n,0)
    }
    assert.equal((await scalar("select has_function_privilege('authenticated','correct_special_item(uuid,uuid,text,integer,jsonb,jsonb,text)','EXECUTE') as allowed")).allowed,false)
  } finally { await db.exec('ROLLBACK') }
})
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
