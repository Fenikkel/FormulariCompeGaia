-- ATENCIÓ: este script elimina la taula resultados i totes les dades actuals.
-- Executa'l una sola vegada en l'editor SQL de Supabase.
drop table if exists public.resultados cascade;
drop function if exists public.actualizar_fecha_resultado();

create table public.resultados (
  id uuid primary key default gen_random_uuid(),
  correo text not null unique check (
    length(btrim(correo)) > 3 and
    correo = lower(btrim(correo)) and
    correo ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ),
  nombre text not null check (length(btrim(nombre)) > 0 and nombre = btrim(nombre)),
  bloque1 smallint not null check (bloque1 in (0, 5, 15)),
  bloque2 smallint not null check (bloque2 in (0, 5, 15)),
  bloque3 smallint not null check (bloque3 in (0, 5, 15)),
  bloque4 smallint not null check (bloque4 in (0, 5, 15)),
  bloque5 smallint not null check (bloque5 in (0, 5, 15)),
  bloque6 smallint not null check (bloque6 in (0, 5, 15)),
  bloque7 smallint not null check (bloque7 in (0, 5, 15)),
  bloque8 smallint not null check (bloque8 in (0, 5, 15)),
  bloque9 smallint not null check (bloque9 in (0, 5, 15)),
  bloque10 smallint not null check (bloque10 in (0, 5, 15)),
  via1 smallint not null check (via1 in (0, 20, 50)),
  via2 smallint not null check (via2 in (0, 20, 50)),
  total smallint not null check (
    total between 0 and 250 and
    total = bloque1 + bloque2 + bloque3 + bloque4 + bloque5 +
            bloque6 + bloque7 + bloque8 + bloque9 + bloque10 + via1 + via2
  ),
  updated_at timestamptz not null default now()
);

create function public.actualizar_fecha_resultado()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger actualizar_fecha_resultado
before update on public.resultados
for each row execute function public.actualizar_fecha_resultado();

create function public.guardar_resultado(
  p_correo text, p_nombre text,
  p_bloque1 smallint, p_bloque2 smallint, p_bloque3 smallint,
  p_bloque4 smallint, p_bloque5 smallint, p_bloque6 smallint,
  p_bloque7 smallint, p_bloque8 smallint, p_bloque9 smallint,
  p_bloque10 smallint, p_via1 smallint, p_via2 smallint, p_total smallint
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.resultados (
    correo, nombre, bloque1, bloque2, bloque3, bloque4, bloque5,
    bloque6, bloque7, bloque8, bloque9, bloque10, via1, via2, total
  ) values (
    lower(btrim(p_correo)), btrim(p_nombre), p_bloque1, p_bloque2, p_bloque3,
    p_bloque4, p_bloque5, p_bloque6, p_bloque7, p_bloque8, p_bloque9,
    p_bloque10, p_via1, p_via2, p_total
  )
  on conflict (correo) do update set
    nombre = excluded.nombre,
    bloque1 = excluded.bloque1, bloque2 = excluded.bloque2,
    bloque3 = excluded.bloque3, bloque4 = excluded.bloque4,
    bloque5 = excluded.bloque5, bloque6 = excluded.bloque6,
    bloque7 = excluded.bloque7, bloque8 = excluded.bloque8,
    bloque9 = excluded.bloque9, bloque10 = excluded.bloque10,
    via1 = excluded.via1, via2 = excluded.via2, total = excluded.total;
$$;

alter table public.resultados enable row level security;
revoke all on public.resultados from anon, authenticated;
revoke all on function public.guardar_resultado(
  text, text, smallint, smallint, smallint, smallint, smallint, smallint,
  smallint, smallint, smallint, smallint, smallint, smallint, smallint
) from public, anon, authenticated;

-- El correu no té permís de lectura pública.
grant select (
  id, nombre, bloque1, bloque2, bloque3, bloque4, bloque5,
  bloque6, bloque7, bloque8, bloque9, bloque10, via1, via2, total, updated_at
) on public.resultados to anon;
grant execute on function public.guardar_resultado(
  text, text, smallint, smallint, smallint, smallint, smallint, smallint,
  smallint, smallint, smallint, smallint, smallint, smallint, smallint
) to anon;

create policy "Lectura publica" on public.resultados
  for select to anon using (true);
