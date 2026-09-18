-- Executa este script una vegada en l’editor SQL d’un projecte nou.
create table public.resultados (
  id uuid primary key,
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
  created_at timestamptz not null default now()
);

alter table public.resultados enable row level security;
revoke all on public.resultados from anon, authenticated;
grant select on public.resultados to anon;
-- La data es genera al servidor; el navegador no pot especificar-la.
grant insert (id, nombre, bloque1, bloque2, bloque3, bloque4, bloque5,
              bloque6, bloque7, bloque8, bloque9, bloque10, via1, via2, total)
on public.resultados to anon;

create policy "Lectura publica" on public.resultados
  for select to anon using (true);
create policy "Insercio publica" on public.resultados
  for insert to anon with check (true);
