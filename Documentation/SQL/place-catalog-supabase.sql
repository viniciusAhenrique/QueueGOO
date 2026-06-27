-- Catalogo proprio de lugares para substituir Google Places em tempo real.
-- Rode no SQL Editor do Supabase antes de popular a base.

create table if not exists public.place_catalogo (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'manual',
  external_id text,
  nome text not null,
  endereco text,
  latitude numeric(10, 7) not null,
  longitude numeric(10, 7) not null,
  telefone text,
  site_url text,
  maps_url text,
  categoria text,
  tipos text[] not null default '{}',
  foto_url text,
  horarios jsonb not null default '[]'::jsonb,
  horario_texto text[] not null default '{}',
  horario_abertura time,
  horario_fechamento time,
  aberto_agora boolean,
  nota numeric(2, 1),
  total_avaliacoes integer,
  busca_texto text not null default '',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique(provider, external_id)
);

create index if not exists idx_place_catalogo_lat_lng
  on public.place_catalogo(latitude, longitude)
  where ativo = true;

create index if not exists idx_place_catalogo_busca_texto
  on public.place_catalogo using gin(to_tsvector('portuguese', busca_texto));

create index if not exists idx_place_catalogo_tipos
  on public.place_catalogo using gin(tipos);

alter table public.place_catalogo
  add column if not exists tripadvisor_location_id text;

create index if not exists idx_place_catalogo_tripadvisor_location_id
  on public.place_catalogo(tripadvisor_location_id)
  where tripadvisor_location_id is not null;

create or replace function public.set_place_catalogo_busca_texto()
returns trigger
language plpgsql
as $$
begin
  new.busca_texto = lower(
    coalesce(new.nome, '') || ' ' ||
    coalesce(new.endereco, '') || ' ' ||
    coalesce(new.categoria, '') || ' ' ||
    coalesce(array_to_string(new.tipos, ' '), '')
  );
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists trg_place_catalogo_busca_texto on public.place_catalogo;

create trigger trg_place_catalogo_busca_texto
before insert or update on public.place_catalogo
for each row
execute function public.set_place_catalogo_busca_texto();
