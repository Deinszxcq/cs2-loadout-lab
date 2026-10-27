create table public.market_quote_cache (
  key text primary key,
  provider text not null check (provider in ('steam','csfloat')),
  data jsonb,
  checked_at timestamptz,
  expires_at timestamptz,
  lease_until timestamptz not null default '-infinity'
);
create table public.market_provider_limits (
  provider text primary key check (provider in ('steam','csfloat')),
  next_at timestamptz not null default '-infinity'
);
insert into public.market_provider_limits(provider) values ('steam'),('csfloat');
alter table public.market_quote_cache enable row level security;
alter table public.market_provider_limits enable row level security;
revoke all on public.market_quote_cache,public.market_provider_limits from public,anon,authenticated;
grant all on public.market_quote_cache,public.market_provider_limits to service_role;

-- Backend-only atomic cache lease and provider-wide pacing. No user data is read.
create function public.claim_market_quote(p_key text,p_provider text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare q public.market_quote_cache%rowtype; gate timestamptz; now_at timestamptz := clock_timestamp();
begin
  if p_provider not in ('steam','csfloat') or length(p_key)>100 or p_key not like p_provider||':%' then
    raise exception 'Invalid quote key';
  end if;
  insert into public.market_quote_cache(key,provider) values(p_key,p_provider) on conflict do nothing;
  select * into q from public.market_quote_cache where key=p_key for update;
  if q.expires_at>now_at then
    return jsonb_build_object('fetch',false,'cached',q.data,'retry_after',0);
  end if;
  if q.lease_until>now_at then
    return jsonb_build_object('fetch',false,'cached',q.data,'retry_after',greatest(1,ceil(extract(epoch from q.lease_until-now_at))));
  end if;
  select next_at into gate from public.market_provider_limits where provider=p_provider for update;
  if gate>now_at then
    return jsonb_build_object('fetch',false,'cached',q.data,'retry_after',greatest(1,ceil(extract(epoch from gate-now_at))));
  end if;
  update public.market_provider_limits set next_at=now_at+case when p_provider='steam' then interval '6 seconds' else interval '1 second' end where provider=p_provider;
  update public.market_quote_cache set lease_until=now_at+interval '25 seconds' where key=p_key;
  return jsonb_build_object('fetch',true,'cached',q.data,'retry_after',0);
end $$;
revoke all on function public.claim_market_quote(text,text) from public,anon,authenticated;
grant execute on function public.claim_market_quote(text,text) to service_role;
