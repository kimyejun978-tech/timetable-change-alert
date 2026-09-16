-- 학생에게 필요한 최소 정보만 반환하도록 RPC를 축소합니다.
-- 교사 ID/이름은 학생용 수업/알림 응답에서 제외합니다.

create or replace function public.get_student_lessons(
  p_neis_office_code text,
  p_neis_school_code text,
  p_grade integer,
  p_class_number integer,
  p_from date,
  p_to date
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row_data order by (row_data->>'lesson_date')::date, (row_data->>'period')::integer), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', l.id,
      'school_id', l.school_id,
      'school_code', s.neis_office_code || ':' || s.neis_school_code,
      'school_name', s.name,
      'lesson_date', l.lesson_date,
      'period', l.period,
      'grade', l.grade,
      'class_number', l.class_number,
      'activity', l.activity,
      'location', l.location,
      'equipment', l.equipment,
      'notice', l.notice,
      'updated_at', l.updated_at
    ) as row_data
    from public.pe_lessons l
    join public.schools s on s.id = l.school_id
    where s.neis_office_code = p_neis_office_code
      and s.neis_school_code = p_neis_school_code
      and l.grade = p_grade
      and l.class_number = p_class_number
      and l.lesson_date between p_from and p_to
  ) q;
$$;

create or replace function public.get_student_notifications(
  p_neis_office_code text,
  p_neis_school_code text,
  p_grade integer,
  p_class_number integer,
  p_from timestamptz
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'lessonId', c.lesson_id,
    'lessonDate', c.lesson_date,
    'period', c.period,
    'grade', c.grade,
    'classNo', c.class_number,
    'changeType', c.change_type,
    'beforeData', c.before_data,
    'afterData', c.after_data,
    'createdAt', c.created_at
  ) order by c.created_at desc), '[]'::jsonb)
  from public.lesson_changes c
  join public.schools s on s.id = c.school_id
  where s.neis_office_code = p_neis_office_code
    and s.neis_school_code = p_neis_school_code
    and c.grade = p_grade
    and c.class_number = p_class_number
    and c.created_at >= p_from
    and c.change_type in ('create', 'update', 'delete');
$$;

revoke execute on function public.get_student_lessons(text,text,integer,integer,date,date) from public, anon, authenticated;
revoke execute on function public.get_student_notifications(text,text,integer,integer,timestamptz) from public, anon, authenticated;
grant execute on function public.get_student_lessons(text,text,integer,integer,date,date) to anon, authenticated;
grant execute on function public.get_student_notifications(text,text,integer,integer,timestamptz) to anon, authenticated;
