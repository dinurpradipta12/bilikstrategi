DELETE FROM public.project_meta
WHERE
  project_id IN (
    'a1111111-1111-1111-1111-111111111111',
    'a2222222-2222-2222-2222-222222222222',
    'a3333333-3333-3333-3333-333333333333',
    'a4444444-4444-4444-4444-444444444444'
  )
  OR meta::text ILIKE ANY (ARRAY[
    '%Nusantara Retail%',
    '%Kopi Senja%',
    '%TechVision%',
    '%GlowSkin%',
    '%Finansial Kuat%',
    '%Brief_Project%',
    '%Key_Visual_Design_Asset%',
    '%Agency Client Group%',
    '%contoh task%',
    '%Syaiful Akhsin%',
    '%Dinur mp%'
  ]);

DELETE FROM public.task_cache
WHERE
  clickup_task_id IN ('cu-869101', 'cu-869102', 'cu-869103', 'cu-869104', 'cu-869105', 'cu-869106', 'cu-869107', 'cu-869108')
  OR task_name ILIKE ANY (ARRAY[
    '%Nusantara Retail%',
    '%Kopi Senja%',
    '%TechVision%',
    '%GlowSkin%',
    '%Finansial Kuat%',
    '%contoh task%'
  ])
  OR raw_data::text ILIKE ANY (ARRAY[
    '%Nusantara Retail%',
    '%Kopi Senja%',
    '%TechVision%',
    '%GlowSkin%',
    '%Finansial Kuat%',
    '%contoh task%'
  ]);

DELETE FROM public.projects
WHERE
  id IN (
    'a1111111-1111-1111-1111-111111111111',
    'a2222222-2222-2222-2222-222222222222',
    'a3333333-3333-3333-3333-333333333333',
    'a4444444-4444-4444-4444-444444444444'
  )
  OR clickup_list_id IN ('list_1001', 'list_1002', 'list_1003', 'list_1004')
  OR name ILIKE ANY (ARRAY[
    '%Nusantara%',
    '%Kopi Senja%',
    '%TechVision%',
    '%GlowSkin%',
    '%Finansial Kuat%'
  ]);

DELETE FROM public.clients
WHERE
  id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444',
    '55555555-5555-5555-5555-555555555555'
  )
  OR company_name ILIKE ANY (ARRAY[
    '%Nusantara Retail%',
    '%Kopi Senja%',
    '%TechVision%',
    '%GlowSkin%',
    '%Finansial Kuat%'
  ]);
