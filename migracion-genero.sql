-- Executa este script una sola vegada en l'editor SQL de Supabase.
-- Conserva els resultats existents i els assigna el gènere «Altre».

alter table public.resultados
  add column genero text not null default 'Altre'
  check (genero in ('Femení', 'Masculí', 'Altre'));

drop function public.guardar_resultado(
  text, text, smallint, smallint, smallint, smallint, smallint, smallint,
  smallint, smallint, smallint, smallint, smallint, smallint, smallint
);

create function public.guardar_resultado(
  p_correo text, p_nombre text, p_genero text,
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
    correo, nombre, genero, bloque1, bloque2, bloque3, bloque4, bloque5,
    bloque6, bloque7, bloque8, bloque9, bloque10, via1, via2, total
  ) values (
    lower(btrim(p_correo)), btrim(p_nombre), p_genero,
    p_bloque1, p_bloque2, p_bloque3, p_bloque4, p_bloque5,
    p_bloque6, p_bloque7, p_bloque8, p_bloque9, p_bloque10,
    p_via1, p_via2, p_total
  )
  on conflict (correo) do update set
    nombre = excluded.nombre,
    genero = excluded.genero,
    bloque1 = excluded.bloque1, bloque2 = excluded.bloque2,
    bloque3 = excluded.bloque3, bloque4 = excluded.bloque4,
    bloque5 = excluded.bloque5, bloque6 = excluded.bloque6,
    bloque7 = excluded.bloque7, bloque8 = excluded.bloque8,
    bloque9 = excluded.bloque9, bloque10 = excluded.bloque10,
    via1 = excluded.via1, via2 = excluded.via2, total = excluded.total;
$$;

revoke all on function public.guardar_resultado(
  text, text, text, smallint, smallint, smallint, smallint, smallint, smallint,
  smallint, smallint, smallint, smallint, smallint, smallint, smallint
) from public, anon, authenticated;

grant execute on function public.guardar_resultado(
  text, text, text, smallint, smallint, smallint, smallint, smallint, smallint,
  smallint, smallint, smallint, smallint, smallint, smallint, smallint
) to anon;

grant select (genero) on public.resultados to anon;
